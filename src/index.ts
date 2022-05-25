import { z, ZodError } from 'zod'
import { v4 } from 'uuid'
import { WebSocket } from 'ws'
import fetch from 'node-fetch'
import { AsyncLocalStorage } from 'async_hooks'
import ISocket, { TimeoutError } from './classes/ISocket'
import { DuplexRPCClient } from './classes/DuplexRPCClient'
import IOError from './classes/IOError'
import Logger from './classes/Logger'
import {
  wsServerSchema,
  hostSchema,
  TRANSACTION_RESULT_SCHEMA_VERSION,
  ENQUEUE_ACTION,
  DEQUEUE_ACTION,
  ActionEnvironment,
  LoadingState,
  CREATE_GHOST_MODE_ACCOUNT,
} from './internalRpcSchema'
import {
  ActionResultSchema,
  IO_RESPONSE,
  T_IO_RESPONSE,
  SerializableRecord,
} from './ioSchema'
import { IOClient } from './classes/IOClient'
import * as pkg from '../package.json'
import { deserializeDates } from './utils/deserialize'
import type {
  ActionCtx,
  ActionLogFn,
  IO,
  IntervalActionHandler,
  IntervalActionDefinition,
  IntervalActionStore,
  NotifyConfig,
} from './types'
import TransactionLoadingState from './classes/TransactionLoadingState'
import localConfig from './localConfig'

export type {
  ActionCtx,
  ActionLogFn,
  IO,
  IntervalActionHandler,
  IntervalActionStore,
}

export interface InternalConfig {
  apiKey?: string
  actions: Record<string, IntervalActionDefinition>
  endpoint?: string
  logLevel?: 'prod' | 'debug'
  retryIntervalMs?: number
  pingIntervalMs?: number
  closeUnresponsiveConnectionTimeoutMs?: number
}

interface SetupConfig {
  instanceId?: string
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface QueuedAction {
  id: string
  assignee?: string
  params?: SerializableRecord
}

export class IntervalError extends Error {
  constructor(message: string) {
    super(message)
  }
}

const actionLocalStorage = new AsyncLocalStorage<IntervalActionStore>()

export function getActionStore(): IntervalActionStore {
  const store = actionLocalStorage.getStore()
  if (!store) {
    throw new IntervalError(
      'Global io and ctx objects can only be used inside an IntervalActionHandler'
    )
  }

  return store
}

// prettier-ignore
export const io: IO = {
  get group() { return getActionStore().io.group },
  get confirm() { return getActionStore().io.confirm },
  get search() { return getActionStore().io.search },
  get input() { return getActionStore().io.input },
  get select() { return getActionStore().io.select },
  get display() { return getActionStore().io.display },
  get experimental() { return getActionStore().io.experimental },
}

// prettier-ignore
export const ctx: ActionCtx = {
  get user() { return getActionStore().ctx.user },
  get params() { return getActionStore().ctx.params },
  get environment() { return getActionStore().ctx.environment },
  get loading() { return getActionStore().ctx.loading },
  get log() { return getActionStore().ctx.log },
  get organization() { return getActionStore().ctx.organization },
  get action() { return getActionStore().ctx.action },
  get notify() { return getActionStore().ctx.notify },
}

function getHttpEndpoint(wsEndpoint: string) {
  const url = new URL(wsEndpoint)
  url.protocol = url.protocol.replace('ws', 'http')
  url.pathname = ''
  const str = url.toString()

  return str.endsWith('/') ? str.slice(0, -1) : str
}

export default class Interval {
  #ghostOrgId: string | undefined
  #apiKey: string | undefined
  #actions: Record<string, IntervalActionDefinition>
  #endpoint: string = 'wss://intervalkit.com/websocket'
  #httpEndpoint: string
  #logger: Logger
  #retryIntervalMs: number = 3000
  #pingIntervalMs: number = 30_000
  #closeUnresponsiveConnectionTimeoutMs: number = 3 * 60 * 1000 // 3 minutes
  #pingIntervalHandle: NodeJS.Timeout | undefined

  actions: Actions

  organization:
    | {
        name: string
        slug: string
      }
    | undefined
  environment: ActionEnvironment | undefined

  constructor(config: InternalConfig) {
    this.#apiKey = config.apiKey
    this.#actions = config.actions
    this.#logger = new Logger(config.logLevel)

    if (config.endpoint) {
      this.#endpoint = config.endpoint
    }

    this.#httpEndpoint = getHttpEndpoint(this.#endpoint)

    if (config.retryIntervalMs && config.retryIntervalMs > 0) {
      this.#retryIntervalMs = config.retryIntervalMs
    }

    if (config.pingIntervalMs && config.pingIntervalMs > 0) {
      this.#pingIntervalMs = config.pingIntervalMs
    }

    if (
      config.closeUnresponsiveConnectionTimeoutMs &&
      config.closeUnresponsiveConnectionTimeoutMs > 0
    ) {
      this.#closeUnresponsiveConnectionTimeoutMs =
        config.closeUnresponsiveConnectionTimeoutMs
    }

    this.actions = new Actions(this.#httpEndpoint, this.#logger, this.#apiKey)
  }

  get #log() {
    return this.#logger
  }

  #ioResponseHandlers = new Map<string, (value: T_IO_RESPONSE) => void>()
  #pendingIOCalls = new Map<string, string>()
  #transactionLoadingStates = new Map<string, LoadingState>()
  #ws: ISocket | undefined = undefined
  #serverRpc:
    | DuplexRPCClient<typeof wsServerSchema, typeof hostSchema>
    | undefined = undefined
  #isConnected = false

  get isConnected() {
    return this.#isConnected
  }

  async listen() {
    await this.#createSocketConnection()
    this.#createRPCClient()
    await this.#initializeHost()
  }

  /**
   * Resends pending IO calls upon reconnection.
   */
  async #resendPendingIOCalls() {
    if (!this.#isConnected) return

    while (this.#pendingIOCalls.size > 0) {
      await Promise.allSettled(
        Array.from(this.#pendingIOCalls.entries()).map(
          ([transactionId, ioCall]) =>
            this.#send('SEND_IO_CALL', {
              transactionId,
              ioCall,
            })
              .then(() => {
                this.#pendingIOCalls.delete(transactionId)
                this.#transactionLoadingStates.delete(transactionId)
              })
              .catch(async err => {
                if (err instanceof IOError) {
                  this.#logger.error(
                    'Failed resending pending IO call: ',
                    err.kind
                  )

                  if (
                    err.kind === 'CANCELED' ||
                    err.kind === 'TRANSACTION_CLOSED'
                  ) {
                    this.#logger.debug('Aborting resending pending IO call')
                    this.#pendingIOCalls.delete(transactionId)
                    return
                  }
                } else {
                  this.#logger.debug('Failed resending pending IO call:', err)
                }

                this.#logger.debug(
                  `Trying again in ${Math.round(
                    this.#retryIntervalMs / 1000
                  )}s...`
                )
                await sleep(this.#retryIntervalMs)
              })
        )
      )
    }
  }

  /**
   * Resends pending transaction loading states upon reconnection.
   */
  async #resendTransactionLoadingStates() {
    if (!this.#isConnected) return

    while (this.#transactionLoadingStates.size > 0) {
      await Promise.allSettled(
        Array.from(this.#transactionLoadingStates.entries()).map(
          ([transactionId, loadingState]) =>
            this.#send('SEND_LOADING_CALL', {
              transactionId,
              ...loadingState,
            })
              .then(() => {
                this.#transactionLoadingStates.delete(transactionId)
              })
              .catch(async err => {
                if (err instanceof IOError) {
                  this.#logger.error(
                    'Failed resending transaction loading state: ',
                    err.kind
                  )

                  if (
                    err.kind === 'CANCELED' ||
                    err.kind === 'TRANSACTION_CLOSED'
                  ) {
                    this.#logger.debug(
                      'Aborting resending transaction loading state'
                    )
                    this.#pendingIOCalls.delete(transactionId)
                    return
                  }
                } else {
                  this.#logger.debug('Failed resending pending IO call:', err)
                }

                this.#logger.debug(
                  `Trying again in ${Math.round(
                    this.#retryIntervalMs / 1000
                  )}s...`
                )
                await sleep(this.#retryIntervalMs)
              })
        )
      )
    }
  }

  async #findOrCreateGhostModeAccount() {
    let config = await localConfig.get()

    let ghostOrgId = config?.ghostOrgId

    if (!ghostOrgId) {
      const response = await fetch(
        this.#httpEndpoint + '/api/auth/ghost/create',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
        .then(r => r.json())
        .then(r => CREATE_GHOST_MODE_ACCOUNT.returns.parseAsync(r))
        .catch(err => {
          this.#log.debug(err)
          throw new IntervalError('Received invalid API response.')
        })

      await localConfig.write({
        ghostOrgId: response.ghostOrgId,
      })

      ghostOrgId = response.ghostOrgId
    }

    return ghostOrgId
  }

  /**
   * Establishes the underlying ISocket connection to Interval.
   */
  async #createSocketConnection(connectConfig?: SetupConfig) {
    const id = connectConfig?.instanceId ?? v4()

    const headers: Record<string, string> = { 'x-instance-id': id }
    if (this.#apiKey) {
      headers['x-api-key'] = this.#apiKey
    } else if (!this.#apiKey) {
      this.#ghostOrgId = await this.#findOrCreateGhostModeAccount()
      headers['x-ghost-org-id'] = this.#ghostOrgId
    }

    const ws = new ISocket(
      new WebSocket(this.#endpoint, {
        headers,
      }),
      { id }
    )

    ws.onClose.attach(async ([code, reason]) => {
      this.#log.prod(
        `❗ Could not connect to Interval (code ${code}). Reason:`,
        reason
      )

      if (this.#pingIntervalHandle) {
        clearInterval(this.#pingIntervalHandle)
        this.#pingIntervalHandle = undefined
      }
      // don't initialize retry process again if already started
      if (!this.#isConnected) return

      this.#log.prod('🔌 Reconnecting...')

      this.#isConnected = false

      while (!this.#isConnected) {
        this.#createSocketConnection({ instanceId: ws.id })
          .then(() => {
            this.#log.prod('⚡ Reconnection successful')
            this.#isConnected = true
            this.#resendPendingIOCalls()
            this.#resendTransactionLoadingStates()
          })
          .catch(() => {
            /* */
          })

        this.#log.prod(
          `Unable to connect. Retrying in ${Math.round(
            this.#retryIntervalMs / 1000
          )}s...`
        )
        await sleep(this.#retryIntervalMs)
      }
    })

    await ws.connect()

    this.#ws = ws
    this.#isConnected = true

    let lastSuccessfulPing = new Date()
    this.#pingIntervalHandle = setInterval(async () => {
      if (!this.#isConnected) {
        if (this.#pingIntervalHandle) {
          clearInterval(this.#pingIntervalHandle)
          this.#pingIntervalHandle = undefined
        }

        return
      }

      try {
        await ws.ping()
        lastSuccessfulPing = new Date()
      } catch (err) {
        this.#logger.warn('Pong not received in time')
        if (!(err instanceof TimeoutError)) {
          this.#logger.error(err)
        }

        if (
          lastSuccessfulPing.getTime() <
          new Date().getTime() - this.#closeUnresponsiveConnectionTimeoutMs
        ) {
          this.#logger.error(
            'No pong received in last three minutes, closing connection to Interval and retrying...'
          )
          if (this.#pingIntervalHandle) {
            clearInterval(this.#pingIntervalHandle)
            this.#pingIntervalHandle = undefined
          }
          ws.close()
        }
      }
    }, this.#pingIntervalMs)

    if (!this.#serverRpc) return

    this.#serverRpc.setCommunicator(ws)

    await this.#initializeHost()
  }

  /**
   * Creates the DuplexRPCClient responsible for sending
   * messages to Interval.
   */
  #createRPCClient() {
    if (!this.#ws) {
      throw new Error('ISocket not initialized')
    }

    const serverRpc = new DuplexRPCClient({
      communicator: this.#ws,
      canCall: wsServerSchema,
      canRespondTo: hostSchema,
      handlers: {
        START_TRANSACTION: async inputs => {
          if (!this.organization) {
            this.#log.error('No organization defined')
            return
          }

          const { actionName: actionSlug, transactionId } = inputs
          const actionDef = this.#actions[actionSlug]
          const actionHandler =
            'handler' in actionDef ? actionDef.handler : actionDef
          this.#log.debug(actionHandler)

          if (!actionHandler) {
            this.#log.debug('No actionHandler called', actionSlug)
            return
          }

          const client = new IOClient({
            logger: this.#logger,
            send: async ioRenderInstruction => {
              const ioCall = JSON.stringify(ioRenderInstruction)
              this.#pendingIOCalls.set(transactionId, ioCall)

              await this.#send('SEND_IO_CALL', {
                transactionId,
                ioCall,
              })

              this.#transactionLoadingStates.delete(transactionId)
            },
          })

          this.#ioResponseHandlers.set(
            transactionId,
            client.onResponse.bind(client)
          )

          // To maintain consistent ordering for logs despite network race conditions
          let logIndex = 0

          const ctx: ActionCtx = {
            user: inputs.user,
            params: deserializeDates(inputs.params),
            environment: inputs.environment,
            organization: this.organization,
            action: {
              slug: actionSlug,
            },
            log: (...args) => this.#sendLog(transactionId, logIndex++, ...args),
            notify: async ({ message, title, delivery }: NotifyConfig) => {
              await this.#send('NOTIFY', {
                transactionId: inputs.transactionId,
                message,
                title,
                deliveryInstructions: delivery,
                createdAt: new Date().toISOString(),
              })
            },
            loading: new TransactionLoadingState({
              logger: this.#logger,
              send: async loadingState => {
                this.#transactionLoadingStates.set(transactionId, loadingState)
                await this.#send('SEND_LOADING_CALL', {
                  transactionId,
                  ...loadingState,
                })
              },
            }),
          }

          const { io } = client

          actionLocalStorage.run({ io, ctx }, () => {
            actionHandler(client.io, ctx)
              .then(res => {
                // Allow actions to return data even after being canceled

                const result: ActionResultSchema = {
                  schemaVersion: TRANSACTION_RESULT_SCHEMA_VERSION,
                  status: 'SUCCESS',
                  data: res || null,
                }

                return result
              })
              .catch(err => {
                // Action did not catch the cancellation error
                if (err instanceof IOError && err.kind === 'CANCELED') throw err

                this.#logger.error(err)

                const result: ActionResultSchema = {
                  schemaVersion: TRANSACTION_RESULT_SCHEMA_VERSION,
                  status: 'FAILURE',
                  data: err.message
                    ? { error: err.name, message: err.message }
                    : null,
                }

                return result
              })
              .then((res: ActionResultSchema) => {
                this.#send('MARK_TRANSACTION_COMPLETE', {
                  transactionId,
                  result: JSON.stringify(res),
                })
              })
              .catch(err => {
                if (err instanceof IOError) {
                  switch (err.kind) {
                    case 'CANCELED':
                      this.#log.prod(
                        'Transaction canceled for action',
                        actionSlug
                      )
                      break
                    case 'TRANSACTION_CLOSED':
                      this.#log.prod(
                        'Attempted to make IO call after transaction already closed in action',
                        actionSlug
                      )
                      break
                  }
                }
              })
              .finally(() => {
                this.#pendingIOCalls.delete(transactionId)
                this.#transactionLoadingStates.delete(transactionId)
                this.#ioResponseHandlers.delete(transactionId)
              })
          })

          return
        },
        IO_RESPONSE: async inputs => {
          this.#log.debug('got io response', inputs)

          try {
            const ioResp = IO_RESPONSE.parse(JSON.parse(inputs.value))
            const replyHandler = this.#ioResponseHandlers.get(
              ioResp.transactionId
            )

            if (!replyHandler) {
              this.#log.debug('Missing reply handler for', inputs.transactionId)
              return
            }

            replyHandler(ioResp)
          } catch (err) {
            if (err instanceof ZodError) {
              this.#log.error('Received invalid IO response:', inputs)
              this.#log.debug(err)
            } else {
              this.#log.error('Failed handling IO response:', err)
            }
          }
        },
      },
    })

    this.#serverRpc = serverRpc
  }

  /**
   * Sends the `INITIALIZE_HOST` RPC call to Interval,
   * declaring the actions that this host is responsible for handling.
   */
  async #initializeHost() {
    if (!this.#serverRpc) {
      throw new Error('serverRpc not initialized')
    }

    if (!this.#ws) {
      throw new Error('ISocket not initialized')
    }

    const actions = Object.entries(this.#actions).map(([slug, def]) => ({
      slug,
      ...('handler' in def ? def : {}),
      handler: undefined,
    }))
    const slugs = Object.keys(this.#actions)

    const loggedIn = await this.#send('INITIALIZE_HOST', {
      apiKey: this.#apiKey,
      actions,
      sdkName: pkg.name,
      sdkVersion: pkg.version,
    })

    if (!loggedIn) throw new Error('The provided API key is not valid')

    if (loggedIn.invalidSlugs.length > 0) {
      this.#log.warn('[Interval]', '⚠ Invalid slugs detected:\n')

      for (const slug of loggedIn.invalidSlugs) {
        this.#log.warn(`  - ${slug}`)
      }

      this.#log.warn(
        '\nAction slugs must contain only letters, numbers, underscores, periods, and hyphens.'
      )

      if (loggedIn.invalidSlugs.length === slugs.length) {
        throw new Error('No valid slugs provided')
      }
    }

    this.organization = loggedIn.organization
    this.environment = loggedIn.environment

    this.#log.prod(
      `🔗 Connected! Access your actions at: ${loggedIn.dashboardUrl}`
    )
    this.#log.debug('Host ID:', this.#ws.id)
  }

  async #send<MethodName extends keyof typeof wsServerSchema>(
    methodName: MethodName,
    inputs: z.input<typeof wsServerSchema[MethodName]['inputs']>
  ) {
    if (!this.#serverRpc) throw new Error('serverRpc not initialized')

    while (true) {
      try {
        return await this.#serverRpc.send(methodName, inputs)
      } catch (err) {
        if (err instanceof TimeoutError) {
          this.#log.debug(
            `RPC call timed out, retrying in ${Math.round(
              this.#retryIntervalMs / 1000
            )}s...`
          )
          this.#log.debug(err)
          sleep(this.#retryIntervalMs)
        } else {
          throw err
        }
      }
    }
  }

  /**
   * This is used for testing and intentionally non-private.
   * Do not use unless you're absolutely sure what you're doing.
   */
  protected async __dangerousInternalSend(methodName: any, inputs: any) {
    if (!this.#serverRpc) throw new Error('serverRpc not initialized')

    return await this.#serverRpc.send(methodName, inputs)
  }

  #sendLog(transactionId: string, index: number, ...args: any[]) {
    if (!args.length) return

    let data = args
      .map(arg => {
        if (arg === undefined) return 'undefined'
        if (typeof arg === 'string') return arg
        return JSON.stringify(arg, undefined, 2)
      })
      .join(' ')

    if (data.length > 10_000) {
      data =
        data.slice(0, 10_000) +
        '...' +
        '\n^ Warning: 10k logline character limit reached.\nTo avoid this error, try separating your data into multiple ctx.log() calls.'
    }

    this.#send('SEND_LOG', {
      transactionId,
      data,
      index,
      timestamp: new Date().valueOf(),
    })
  }
}

/**
 * This is effectively a namespace inside of Interval with a little bit of its own state.
 */
class Actions {
  #logger: Logger
  #apiKey?: string
  #endpoint: string

  constructor(endpoint: string, logger: Logger, apiKey?: string) {
    this.#apiKey = apiKey
    this.#logger = logger
    this.#endpoint = endpoint + '/api/actions'
  }

  #getAddress(path: string): string {
    if (path.startsWith('/')) {
      path = path.substring(1)
    }

    return `${this.#endpoint}/${path}`
  }

  async enqueue(
    slug: string,
    config: Pick<QueuedAction, 'assignee' | 'params'> = {}
  ): Promise<QueuedAction> {
    let body: z.infer<typeof ENQUEUE_ACTION['inputs']>
    try {
      body = ENQUEUE_ACTION.inputs.parse({
        ...config,
        slug,
      })
    } catch (err) {
      this.#logger.debug(err)
      throw new IntervalError('Invalid input.')
    }

    const response = await fetch(this.#getAddress('enqueue'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(r => ENQUEUE_ACTION.returns.parseAsync(r))
      .catch(err => {
        this.#logger.debug(err)
        throw new IntervalError('Received invalid API response.')
      })

    if (response.type === 'error') {
      throw new IntervalError(
        `There was a problem enqueuing the action: ${response.message}`
      )
    }

    return {
      id: response.id,
      ...config,
    }
  }

  async dequeue(id: string): Promise<QueuedAction> {
    let body: z.infer<typeof DEQUEUE_ACTION['inputs']>
    try {
      body = DEQUEUE_ACTION.inputs.parse({
        id,
      })
    } catch (err) {
      this.#logger.debug(err)
      throw new IntervalError('Invalid input.')
    }

    const response = await fetch(this.#getAddress('dequeue'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(r => DEQUEUE_ACTION.returns.parseAsync(r))
      .catch(err => {
        this.#logger.debug(err)
        throw new IntervalError('Received invalid API response.')
      })

    if (response.type === 'error') {
      throw new IntervalError(
        `There was a problem enqueuing the action: ${response.message}`
      )
    }

    const { type, ...rest } = response

    return rest
  }
}

export { Interval, IOError }
