import { WebSocket } from 'ws'
import ISocket from './ISocket'
import { createDuplexRPCClient } from './rpc'
import { wsServerSchema, hostSchema } from './internalRpcSchema'
import { IO_RESPONSE, T_IO_RESPONSE, T_IO_METHOD } from './ioSchema'
import createIOClient, { IOClient } from './io'
import { z } from 'zod'
import { v4 } from 'uuid'

interface ActionCtx {
  user: z.infer<typeof hostSchema['START_TRANSACTION']['inputs']>['user']
}

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

export default async function createIntervalHost(config: InternalConfig) {
  const log = {
    prod: (...args: any[]) => {
      console.log('[Interval] ', ...args)
    },
    debug: (...args: any[]) => {
      if (config.logLevel === 'debug') {
        console.log(...args)
      }
    },
  }

  log.debug('Create Interval Host :)', config)

  const ioResponseHandlers = new Map<string, (value: T_IO_RESPONSE) => void>()

  let retryCount = 0

  async function setup(setupConfig?: SetupConfig) {
    const id = setupConfig?.instanceId || v4()
    const ws = new ISocket(
      new WebSocket(config.endpoint || 'wss://intervalkit.com:3003', {
        headers: {
          'x-api-key': config.apiKey,
          'x-instance-id': id,
        },
      }),
      { id }
    )

    ws.on('close', async (code, reason) => {
      // don't initialize retry process again if already started
      if (retryCount > 0) return

      log.prod(`❗ Lost connection to Interval (code ${code}). Reason:`, reason)
      log.prod('🔌 Reconnecting...')

      retryCount = 0
      let didReconnect = false
      let retryStart = performance.now()

      while (retryCount <= 10 && !didReconnect) {
        retryCount++

        setup({ instanceId: ws.id })
          .then(() => {
            console.log('⚡ Reconnection successful')
            retryCount = 0
            didReconnect = true
          })
          .catch(() => {
            /* */
          })

        // we could do exponential backoff here, but in most cases (server restart, dev mode) the
        // sever is back up within ~5-7 seconds, and when EB is enabled you just end up waiting longer than necessary.
        console.log(`Unable to connect. Retrying in 3s...`)
        await sleep(3000)
      }

      if (didReconnect) return

      const retryEnd = performance.now() - retryStart

      console.log(`❗ Could not connect to Interval after ${retryEnd}ms.`)
    })

    await ws.connect()

    const serverRpc = createDuplexRPCClient({
      communicator: ws,
      canCall: wsServerSchema,
      canRespondTo: hostSchema,
      handlers: {
        START_TRANSACTION: async inputs => {
          const fn = config.actions[inputs.actionName]
          log.debug(fn)

          if (!fn) {
            log.debug('No fn called', inputs.actionName)
            return
          }

          const client = createIOClient({
            send: async ioRenderInstruction => {
              await serverRpc('SEND_IO_CALL', {
                transactionId: inputs.transactionId,
                ioCall: JSON.stringify(ioRenderInstruction),
              })
            },
          })

          ioResponseHandlers.set(inputs.transactionId, client.onResponse)

          const ctx: ActionCtx = {
            user: inputs.user,
          }

          fn(client.io, ctx).then(() =>
            serverRpc('MARK_TRANSACTION_COMPLETE', {
              transactionId: inputs.transactionId,
            })
          )

          return
        },
        IO_RESPONSE: async inputs => {
          log.debug('got io response', inputs)

          const ioResp = IO_RESPONSE.parse(JSON.parse(inputs.value))
          const replyHandler = ioResponseHandlers.get(ioResp.transactionId)

          if (!replyHandler) {
            log.debug('Missing reply handler for', inputs.transactionId)
            return
          }

          replyHandler(ioResp)
          ioResponseHandlers.delete(ioResp.id)
        },
      },
    })

    const loggedIn = await serverRpc('INITIALIZE_HOST', {
      apiKey: config.apiKey,
      callableActionNames: Object.keys(config.actions),
    })

    if (!loggedIn) throw new Error('The provided API key is not valid')

    log.prod(`🔗 Connected! Access your actions at: ${loggedIn.dashboardUrl}`)
    log.debug('Host ID:', ws.id)
  }

  setup()

  return true
}
