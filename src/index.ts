import { WebSocket } from 'ws'
import { EventEmitter as EE } from 'ee-ts'
import ISocket from './ISocket'
import { createCaller, createDuplexRPCClient } from './rpc'
import { wsServerSchema, hostSchema } from './internalRpcSchema'
import { ioSchema } from './ioSchema'
import { z } from 'zod'

function autoTry(fn: () => any) {
  const steps = [1000, 3000, 10000]
  let triesAtStep = 0
  let pos = 0

  let timeout: NodeJS.Timeout | null = null

  const tick = () => {
    console.log('Starting TO for', steps[pos])
    timeout = setTimeout(() => {
      console.log('STO', steps[pos])
      fn()

      triesAtStep = triesAtStep + 1

      if (triesAtStep > 5) {
        triesAtStep = 0
        pos = pos >= 2 ? 0 : pos + 1
      }

      tick()
    }, steps[pos])
  }

  tick()

  return function cancel() {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

const ioShape = createDuplexRPCClient({
  communicator: {
    on: () => {
      /**/
    },
    send: async () => {
      /**/
    },
  },
  canCall: ioSchema,
  canRespondTo: {},
  handlers: {},
})

type ActionFunction = (io: typeof ioShape) => any

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

  const inProgressTransactions = new Map<string, (value: string) => void>()

  async function setup() {
    const ws = new ISocket(
      new WebSocket(config.endpoint || 'ws://localhost:3001')
    )

    ws.on('close', () => {
      log.debug('Closed')
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

          const io = createCaller({
            schema: ioSchema,
            send: async (text: string) => {
              log.debug('emitting', text)
              await serverRpc('SEND_IO_CALL', {
                transactionId: inputs.transactionId,
                ioCall: text,
              })
              log.debug('sent')
            },
          })

          inProgressTransactions.set(inputs.transactionId, io.replyHandler)

          fn(io.client)

          return
        },
        IO_RESPONSE: async inputs => {
          log.debug('got io response', inputs)

          const replyHandler = inProgressTransactions.get(inputs.transactionId)
          if (!replyHandler) {
            log.debug('Missing reply handler for', inputs.transactionId)
            return
          }

          replyHandler(inputs.value)
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
