import { WebSocket } from 'ws'
import ISocket from './ISocket'
import { createDuplexRPCClient } from './rpc'
import { wsServerSchema, hostSchema } from './internalRpcSchema'
import { IO_RESPONSE, T_IO_RESPONSE, T_IO_METHOD } from './ioSchema'
import createIOClient, { IOClient } from './io'
import { z } from 'zod'

interface ActionCtx {
  user: z.infer<typeof hostSchema['START_TRANSACTION']['inputs']>['user']
}

type ActionFunction = (io: IOClient['io'], ctx: ActionCtx) => Promise<any>

interface InternalConfig {
  apiKey: string
  actions: Record<string, ActionFunction>
  endpoint?: string
  logLevel?: 'prod' | 'debug'
}

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

  async function setup() {
    const ws = new ISocket(
      new WebSocket(config.endpoint || 'wss://intervalkit.com:3002', {
        headers: {
          'x-api-key': config.apiKey,
        },
      })
    )

    ws.on('close', (code, reason) => {
      log.prod(
        `❗️ Could not connect to Interval (code ${code}). Reason:`,
        reason
      )
      // auto retry connect here?
    })

    await ws.connect()

    const serverRpc = createDuplexRPCClient({
      communicator: ws,
      canCall: wsServerSchema,
      canRespondTo: hostSchema,
      handlers: {
        START_TRANSACTION: async inputs => {
          log.debug('action called', inputs)

          const fn = config.actions[inputs.actionName]
          log.debug(fn)

          if (!fn) {
            log.debug('No fn called', inputs.actionName)
            return
          }

          const client = createIOClient({
            send: async ioRenderInstruction => {
              log.debug('emitting', ioRenderInstruction)
              await serverRpc('SEND_IO_CALL', {
                transactionId: inputs.transactionId,
                ioCall: JSON.stringify(ioRenderInstruction),
              })
              log.debug('sent')
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
  }

  setup()

  return true
}
