import Interval, { io, Layout, Page } from '../../index'

const interval = new Interval({
  // apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes: {
    page: new Page({
      name: 'IO Example',
      description: 'This is an example of the Interval SDK',
      handler: async () => {
        return new Layout({
          children: [io.display.markdown('Hello world')],
        })
      },
    }),

    identity: async () => {
      await io.confirmIdentity('Confirm identity')
    },

    datetime: async () => {
      const datetime = await io.input.datetime('Enter datetime', {
        min: new Date(2000, 0, 1, 7, 30),
        max: {
          year: 2022,
          month: 12,
          day: 30,
          hour: 13,
          minute: 0,
        },
      })
      return datetime
    },

    hello_world: async () => {
      const [name, email] = await io.group([
        // implemented by ui package
        io.input.text('What is your name?'),
        // not yet implemented; should fall back to the web client's component
        io.input.email('What is your email?'),
        io.display.table('Table', {
          data: [
            ['a', 'b', 'c'],
            ['d', 'e', 'f'],
            ['g', 'h', 'i'],
          ],
        }),
      ])
      return `Hello ${name}! Your email is ${email}.`
    },
  },
})

interval.listen()
