import { WebSocket } from 'ws'
import ISocket from './ISocket'
import { createDuplexRPCClient, DuplexRPCClient } from './rpc'
import { wsServerSchema, hostSchema } from './internalRpcSchema'
import { IO_RESPONSE, T_IO_RESPONSE } from './ioSchema'
import createIOClient, { IOClient } from './io'
import { z } from 'zod'
import { v4 } from 'uuid'

type ActionCtx = Pick<
  z.infer<typeof hostSchema['START_TRANSACTION']['inputs']>,
  'user' | 'params'
>

export type IntervalActionHandler = (
  io: IOClient['io'],
  ctx: ActionCtx
) => Promise<any>

interface InternalConfig {
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

class Logger {
  logLevel: LogLevel = 'prod'

  constructor(logLevel?: LogLevel) {
    if (logLevel) {
      this.logLevel = logLevel
    }
  }

  prod(...args: any[]) {
    console.log('[Interval] ', ...args)
  }

  debug(...args: any[]) {
    if (this.logLevel === 'debug') {
      console.debug(...args)
    }
  }
}

export default class Interval {
  #apiKey: string
  #endpoint: string = 'wss://intervalkit.com:3003'
  #logger: Logger
  #actions

  constructor(config: InternalConfig) {
    this.#apiKey = config.apiKey
    if (config.endpoint) {
      this.#endpoint = config.endpoint
    }

    this.#logger = new Logger(config.logLevel)

    this.#actions = {
      actions: config.actions ?? ({} as Record<string, IntervalActionHandler>),
      add: this.#addActions,
      remove: this.#removeActions,
      // TODO: enqueue, dequeue
    }
  }

  get #log() {
    return this.#logger
  }

  get actions() {
    return this.#actions
  }

  #addActions(actions: Record<string, IntervalActionHandler>) {
    this.#actions.actions = {
      ...this.#actions.actions,
      ...actions,
    }
  }

  #removeActions(...actionNames: string[]) {
    for (const name of actionNames) {
      delete this.#actions.actions[name]
    }
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
            console.log('⚡ Reconnection successful')
            this.#isConnected = true
          })
          .catch(() => {
            /* */
          })

        // we could do exponential backoff here, but in most cases (server restart, dev mode) the
        // sever is back up within ~5-7 seconds, and when EB is enabled you just end up waiting longer than necessary.
        console.log(`Unable to connect. Retrying in 3s...`)
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
          const fn = this.#actions.actions[inputs.actionName]
          this.#log.debug(fn)

          if (!fn) {
            this.#log.debug('No fn called', inputs.actionName)
            return
          }

          const client = createIOClient({
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
          }

          fn(client.io, ctx).then(() =>
            serverRpc.send('MARK_TRANSACTION_COMPLETE', {
              transactionId: inputs.transactionId,
            })
          )

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

    const loggedIn = await this.#serverRpc.send('INITIALIZE_HOST', {
      apiKey: this.#apiKey,
      callableActionNames: Object.keys(this.#actions.actions),
    })

    if (!loggedIn) throw new Error('The provided API key is not valid')

    this.#log.prod(
      `🔗 Connected! Access your actions at: ${loggedIn.dashboardUrl}`
    )
    this.#log.debug('Host ID:', this.#ws.id)
  }
}
