import { WebSocket } from 'ws'
import ISocket from '../../common/src/ISocket'
import { createCaller } from '../../common/src/rpc'
import { internalRpcSchema } from '../../common/src/internalRpcSchema'

interface InternalConfig {
  apiKey: string
}

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

export default async function createIntervalHost(config: InternalConfig) {
  console.log('Create Interval Host :)', config)

  async function setup() {
    const ws = new ISocket(new WebSocket('ws://localhost:2023'))

    ws.on('close', () => {
      console.log('Closed')
      // auto retry connect here?
    })

    const caller = createCaller({
      schema: internalRpcSchema,
      send: rawInput => ws.send(rawInput),
    })
    ws.on('message', m => caller.replyHandler(m))

    await ws.connect()
    console.log('Connected!')

    const loggedIn = await caller.client('INITIALIZE_HOST', {
      apiKey: config.apiKey,
      callableActionNames: ['Hello world', 'Delete account'],
    })
    if (!loggedIn) throw new Error('The provided API key is not valid')
  }

  setup()

  return true
}
