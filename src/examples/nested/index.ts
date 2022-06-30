import Interval, { ActionGroup } from '../..'

const interval = new Interval({
  apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
})

const nested = new ActionGroup('Nested', {
  hello: async io => {
    const message = await io.input.text('Hello?')

    return message
  },
  configure: async io => {
    const message = await io.input.text('Hello?')

    return message
  },
})

nested.use(
  'more',
  new ActionGroup('More nested', {
    hello: async io => {
      const message = await io.input.text('Hello?')

      return message
    },
  })
)

interval.use('nested', nested)

interval.listen()

const anon = new Interval({
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
})

anon.use('nested', nested)

anon.listen()

const prod = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  groups: {
    'test/deeper': new ActionGroup('Deeper', {
      hello: async io => {
        const message = await io.input.text('Hello?')

        return message
      },
      configure: async io => {
        const message = await io.input.text('Hello?')

        return message
      },
    }),
  },
})

prod.listen()
