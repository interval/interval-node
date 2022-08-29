import { IntervalActionHandler } from '../..'
import ExperimentalInterval, { ActionGroup, io } from '../../experimental'

const action: IntervalActionHandler = async () => {
  const message = await io.input.text('Hello?')

  return message
}

const devOnly = new ActionGroup({
  name: 'Dev-only',
  actions: {
    action,
  },
})

const interval = new ExperimentalInterval({
  apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    devOnly,
    toRemove: new ActionGroup({
      name: 'To remove',
      actions: {
        action,
      },
    }),
  },
})

interval.actions.add('new_action', async () => {
  'Hello, dynamism!'
})

const nested = new ActionGroup({
  name: 'Nested',
  actions: {
    action,
    hello: action,
    configure: action,
  },
})

nested.add(
  'more',
  new ActionGroup({
    name: 'More nested',
    actions: {
      action,
    },
  })
)

interval.actions.add('nested', nested)

nested.add(
  'other',
  new ActionGroup({
    name: 'Other',
    actions: {
      action,
      hello: action,
    },
  })
)

interval.listen().then(() => {
  interval.actions.add(
    'new',
    new ActionGroup({
      name: 'New Group',
      actions: {
        action,
      },
    })
  )

  interval.actions.remove('toRemove')

  devOnly.add('self_destructing', async () => {
    devOnly.remove('self_destructing')
    return 'Bye!'
  })
})

const anon = new ExperimentalInterval({
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
})

anon.actions.add('nested', nested)

anon.listen()

const prod = new ExperimentalInterval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
})

prod.actions.add('test', nested)

prod.listen()
