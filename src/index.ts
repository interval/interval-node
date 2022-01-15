import { WebSocket } from 'ws'
import ISocket from './ISocket'
import { createDuplexRPCClient } from './rpc'
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
}

export default async function createIntervalHost(config: InternalConfig) {
  console.log('Create Interval Host :)', config)

  async function setup() {
    const ws = new ISocket(new WebSocket('ws://localhost:2023'))

    ws.on('close', () => {
      console.log('Closed')
      // auto retry connect here?
    })

    await ws.connect()
    console.log('Connected!')

    const serverRpc = createDuplexRPCClient({
      communicator: ws,
      canCall: wsServerSchema,
      canRespondTo: hostSchema,
      handlers: {
        START_TRANSACTION: async inputs => {
          console.log('action called', inputs)

          const fn = config.actions[inputs.actionName]
          console.log(fn)

          if (!fn) {
            console.log('No fn called', inputs.actionName)
            return
          }

          const io = createDuplexRPCClient({
            communicator: {
              on: () => {
                /**/
              },
              send: async (text: string) => {
                console.log('emitting', text)
                await serverRpc('SEND_IO_CALL', {
                  transactionId: inputs.transactionId,
                  ioCall: text,
                })
                console.log('sent')
              },
            },
            canCall: ioSchema,
            canRespondTo: {},
            handlers: {},
          })

          fn(io)

          return
        },
        IO_RESPONSE: async inputs => {
          console.log('got io response', inputs)
        },
      },
    })

    const loggedIn = await serverRpc('INITIALIZE_HOST', {
      apiKey: config.apiKey,
      callableActionNames: Object.keys(config.actions),
    })

    if (!loggedIn) throw new Error('The provided API key is not valid')
  }

  setup()

  return true
}
