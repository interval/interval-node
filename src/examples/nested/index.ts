import { IntervalActionHandler } from '../..'
import ExperimentalInterval, { ActionGroup } from '../../experimental'

const interval = new ExperimentalInterval({
  apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
})

const action: IntervalActionHandler = async io => {
  const message = await io.input.text('Hello?')

  return message
}

const nested = new ActionGroup({
  name: 'Nested',
  actions: {
    action,
    hello: action,
    configure: action,
  },
})

nested.use(
  'more',
  new ActionGroup({
    name: 'More nested',
    actions: {
      action,
    },
  })
)

interval.use('nested', nested)

nested.use(
  'other',
  new ActionGroup({
    name: 'Other',
    actions: {
      action,
      hello: action,
    },
  })
)

interval.listen()

const anon = new ExperimentalInterval({
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
})

anon.use('nested', nested)

anon.listen()

const prod = new ExperimentalInterval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
})

prod.use('test', nested)

prod.listen()
