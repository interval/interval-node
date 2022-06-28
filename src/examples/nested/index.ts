import Interval from '../..'
import { IntervalActionDefinitions } from '../../types'

const interval = new Interval({
  apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
})

const nested: IntervalActionDefinitions = {
  hello: async io => {
    const message = await io.input.text('Hello?')

    return message
  },
  configure: async io => {
    const message = await io.input.text('Hello?')

    return message
  },
}

interval.use('nested', nested)

interval.listen()

const prod = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  prefix: '/test',
})

prod.use('deeper', {
  hello: async io => {
    const message = await io.input.text('Hello?')

    return message
  },
  configure: async io => {
    const message = await io.input.text('Hello?')

    return message
  },
})

prod.listen()
