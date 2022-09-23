import { IntervalActionHandler } from '../..'
import ExperimentalInterval, { Router, io } from '../../experimental'

const action: IntervalActionHandler = async () => {
  const message = await io.input.text('Hello?')

  return message
}

const devOnly = new Router({
  name: 'Dev-only',
  routes: {
    action,
  },
})

const interval = new ExperimentalInterval({
  apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes: {
    devOnly,
    toRemove: new Router({
      name: 'To remove',
      routes: {
        action,
      },
    }),
  },
})

interval.routes.add('new_action', async () => {
  'Hello, dynamism!'
})

const nested = new Router({
  name: 'Nested',
  routes: {
    action,
    hello: action,
    configure: action,
  },
})

nested.add(
  'more',
  new Router({
    name: 'More nested',
    routes: {
      action,
    },
  })
)

interval.routes.add('nested', nested)

nested.add(
  'other',
  new Router({
    name: 'Other',
    routes: {
      action,
      hello: action,
    },
  })
)

interval.listen().then(() => {
  interval.routes.add(
    'new',
    new Router({
      name: 'New Group',
      routes: {
        action,
      },
    })
  )

  interval.routes.remove('toRemove')

  devOnly.add('self_destructing', async () => {
    devOnly.remove('self_destructing')
    return 'Bye!'
  })
})

const anon = new ExperimentalInterval({
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
})

anon.routes.add('nested', nested)

anon.listen()

const prod = new ExperimentalInterval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
})

prod.routes.add('test', nested)

prod.listen()
