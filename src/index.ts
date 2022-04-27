import { z } from 'zod'
import { v4 } from 'uuid'
import { WebSocket } from 'ws'
import fetch from 'node-fetch'
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
import type { ActionCtx, ActionLogFn, IO, IntervalActionHandler } from './types'
import TransactionLoadingState from './classes/TransactionLoadingState'

export interface InternalConfig {
  apiKey: string
  actions: Record<string, IntervalActionHandler>
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

export type { ActionCtx, ActionLogFn, IO, IntervalActionHandler }

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

export default class Interval {
  #actions: Record<string, IntervalActionHandler>
  #apiKey: string
  #endpoint: string = 'wss://intervalkit.com/websocket'
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

    this.actions = new Actions(this.#apiKey, this.#endpoint)
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

  /**
   * Establishes the underlying ISocket connection to Interval.
   */
  async #createSocketConnection(connectConfig?: SetupConfig) {
    const id = connectConfig?.instanceId ?? v4()

    const ws = new ISocket(
      new WebSocket(this.#endpoint, {
        headers: {
          'x-api-key': this.#apiKey,
          'x-instance-id': id,
        },
      }),
      { id }
    )

    ws.onClose.attach(async ([code, reason]) => {
      if (this.#pingIntervalHandle) {
        clearInterval(this.#pingIntervalHandle)
        this.#pingIntervalHandle = undefined
      }
      // don't initialize retry process again if already started
      if (!this.#isConnected) return

      this.#log.prod(
        `❗ Lost connection to Interval (code ${code}). Reason:`,
        reason
      )
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
          const { actionName: actionSlug, transactionId } = inputs
          if (!this.organization) {
            this.#log.error('No organization defined')
            return
          }

          const fn = this.#actions[actionSlug]
          this.#log.debug(fn)

          if (!fn) {
            this.#log.debug('No fn called', actionSlug)
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

          fn(client.io, ctx)
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

          return
        },
        IO_RESPONSE: async inputs => {
          this.#log.debug('got io response', inputs)

          const ioResp = IO_RESPONSE.parse(JSON.parse(inputs.value))
          const replyHandler = this.#ioResponseHandlers.get(
            ioResp.transactionId
          )

          if (!replyHandler) {
            this.#log.debug('Missing reply handler for', inputs.transactionId)
            return
          }

          replyHandler(ioResp)
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

    const slugs = Object.keys(this.#actions)

    const loggedIn = await this.#send('INITIALIZE_HOST', {
      apiKey: this.#apiKey,
      callableActionNames: slugs,
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

  #sendLog(transactionId: string, index: number, ...args: any[]) {
    if (!args.length) return

    let data = args
      .map(arg => {
        if (arg === undefined) return 'undefined'
        if (typeof arg === 'string') return arg
        return JSON.stringify(arg, undefined, 2)
      })
      .join(' ')

    if (data.length > 100_000) {
      data =
        data.slice(0, 100_000) +
        '...' +
        '\n^ Warning: 100k logline character limit reached.\nTo avoid this error, try separating your data into multiple ctx.log() calls.'
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
  #apiKey: string
  #endpoint: string

  constructor(apiKey: string, endpoint: string) {
    this.#apiKey = apiKey
    const url = new URL(endpoint)
    url.protocol = url.protocol.replace('ws', 'http')
    url.pathname = '/api/actions'
    this.#endpoint = url.toString()
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
      .catch(() => {
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
      .catch(() => {
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
