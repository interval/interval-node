import { WebSocket } from 'ws'
import ISocket from './ISocket'
import { createDuplexRPCClient, DuplexRPCClient } from './rpc'
import {
  wsServerSchema,
  hostSchema,
  TRANSACTION_RESULT_SCHEMA_VERSION,
} from './internalRpcSchema'
import {
  ActionResultSchema,
  IOFunctionReturnType,
  IO_RESPONSE,
  T_IO_RESPONSE,
} from './ioSchema'
import createIOClient, { IOClient } from './io'
import { z } from 'zod'
import { v4 } from 'uuid'

type ActionCtx = Pick<
  z.infer<typeof hostSchema['START_TRANSACTION']['inputs']>,
  'user' | 'params' | 'environment'
>

export type IntervalActionHandler = (
  io: IOClient['io'],
  ctx: ActionCtx
) => Promise<IOFunctionReturnType | void>

export interface InternalConfig {
  apiKey: string
  actions: Record<string, IntervalActionHandler>
  endpoint?: string
  logLevel?: 'prod' | 'debug'
}

interface SetupConfig {
  instanceId?: string
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type LogLevel = 'prod' | 'debug'

export class Logger {
  logLevel: LogLevel = 'prod'

  constructor(logLevel?: LogLevel) {
    if (logLevel) {
      this.logLevel = logLevel
    }
  }

  prod(...args: any[]) {
    console.log('[Interval] ', ...args)
  }

  warn(...args: any[]) {
    console.warn(...args)
  }

  error(...args: any[]) {
    console.error(...args)
  }

  debug(...args: any[]) {
    if (this.logLevel === 'debug') {
      console.debug(...args)
    }
  }
}

export interface QueuedAction {
  id: string
  assignee?: string
  params?: Record<string, string>
}

class IntervalError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export default class Interval {
  #actions: Record<string, IntervalActionHandler>
  #apiKey: string
  #endpoint: string = 'wss://intervalkit.com:3003'
  #logger: Logger

  constructor(config: InternalConfig) {
    this.#apiKey = config.apiKey
    this.#actions = config.actions
    this.#logger = new Logger(config.logLevel)

    if (config.endpoint) {
      this.#endpoint = config.endpoint
    }
  }

  get #log() {
    return this.#logger
  }

  // It feels a little wasteful to create a new object every time this getter
  // is called, but defining it ahead of time allows consumers to reassign to it
  // statefully which I think we would rather avoid.
  get actions() {
    return {
      enqueue: this.#enqueueAction.bind(this),
      dequeue: this.#dequeueAction.bind(this),
    }
  }

  async #enqueueAction(
    slug: string,
    config: Pick<QueuedAction, 'assignee' | 'params'> = {}
  ): Promise<QueuedAction> {
    // TODO: Richer error types

    if (!this.#isConnected || !this.#ws || !this.#serverRpc) {
      throw new IntervalError(
        'Connection not established. Please be sure to call listen() before enqueueing actions.'
      )
    }

    if (config.params) {
      if (
        typeof config.params !== 'object' ||
        Array.isArray(config.params) ||
        Object.entries(config.params).some(
          ([key, val]) =>
            typeof key !== 'string' ||
            (typeof val !== 'string' && typeof val !== 'number')
        )
      ) {
        throw new IntervalError(
          'Invalid params, please pass an object of strings or numbers'
        )
      }
    }

    const response = await this.#serverRpc.send('ENQUEUE_ACTION', {
      actionName: slug,
      ...config,
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

  async #dequeueAction(id: string): Promise<QueuedAction> {
    // TODO: Richer error types

    if (!this.#isConnected || !this.#ws || !this.#serverRpc) {
      throw new IntervalError(
        'Connection not established. Please be sure to call listen() before enqueueing actions.'
      )
    }

    const response = await this.#serverRpc.send('DEQUEUE_ACTION', { id })

    if (response.type === 'error') {
      throw new IntervalError('There was a problem dequeuing the action')
    }

    const { type, ...rest } = response

    return rest
  }

  #ioResponseHandlers = new Map<string, (value: T_IO_RESPONSE) => void>()
  #ws: ISocket | undefined = undefined
  #serverRpc: DuplexRPCClient<typeof wsServerSchema> | undefined = undefined
  #isConnected = false

  get isConnected() {
    return this.#isConnected
  }

  async listen() {
    await this.#createSocketConnection()
    this.#createRPCClient()
    await this.#initializeHost()
  }

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
          })
          .catch(() => {
            /* */
          })

        // we could do exponential backoff here, but in most cases (server restart, dev mode) the
        // sever is back up within ~5-7 seconds, and when EB is enabled you just end up waiting longer than necessary.
        this.#log.prod(`Unable to connect. Retrying in 3s...`)
        await sleep(3000)
      }
    })

    await ws.connect()

    this.#ws = ws
    this.#isConnected = true

    if (!this.#serverRpc) return

    this.#serverRpc.setCommunicator(ws)

    await this.#initializeHost()
  }

  #createRPCClient() {
    if (!this.#ws) {
      throw new Error('ISocket not initialized')
    }

    const serverRpc = createDuplexRPCClient({
      communicator: this.#ws,
      canCall: wsServerSchema,
      canRespondTo: hostSchema,
      handlers: {
        START_TRANSACTION: async inputs => {
          const slug = inputs.actionName
          const fn = this.#actions[slug]
          this.#log.debug(fn)

          if (!fn) {
            this.#log.debug('No fn called', slug)
            return
          }

          const client = createIOClient({
            logger: this.#logger,
            send: async ioRenderInstruction => {
              await serverRpc.send('SEND_IO_CALL', {
                transactionId: inputs.transactionId,
                ioCall: JSON.stringify(ioRenderInstruction),
              })
            },
          })

          this.#ioResponseHandlers.set(inputs.transactionId, client.onResponse)

          const ctx: ActionCtx = {
            user: inputs.user,
            params: inputs.params,
            environment: inputs.environment,
          }

          fn(client.io, ctx)
            .then(res => {
              const result: ActionResultSchema = {
                schemaVersion: TRANSACTION_RESULT_SCHEMA_VERSION,
                status: 'SUCCESS',
                data: res || null,
              }

              return result
            })
            .catch(e => {
              const result: ActionResultSchema = {
                schemaVersion: TRANSACTION_RESULT_SCHEMA_VERSION,
                status: 'FAILURE',
                data: e.message ? { message: e.message } : null,
              }

              return result
            })
            .then((res: ActionResultSchema) => {
              serverRpc.send('MARK_TRANSACTION_COMPLETE', {
                transactionId: inputs.transactionId,
                result: JSON.stringify(res),
              })
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
          this.#ioResponseHandlers.delete(ioResp.id)
        },
      },
    })

    this.#serverRpc = serverRpc
  }

  async #initializeHost() {
    if (!this.#serverRpc) {
      throw new Error('serverRpc not initialized')
    }

    if (!this.#ws) {
      throw new Error('ISocket not initialized')
    }

    const slugs = Object.keys(this.#actions)

    const loggedIn = await this.#serverRpc.send('INITIALIZE_HOST', {
      apiKey: this.#apiKey,
      callableActionNames: slugs,
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

      this.#log.warn(
        'Please rename your action name keys to slugs and deploy again.\n'
      )

      if (loggedIn.invalidSlugs.length === slugs.length) {
        throw new Error('No valid slugs provided')
      }
    }

    this.#log.prod(
      `🔗 Connected! Access your actions at: ${loggedIn.dashboardUrl}`
    )
    this.#log.debug('Host ID:', this.#ws.id)
  }
}

export { Interval }
