import Interval, { io } from '../../index'

const interval = new Interval({
  apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes: {
    hello_world: async () => {
      const [name, email] = await io.group([
        // implemented by io-client
        io.input.text('What is your name?'),
        // not yet implemented; should fall back to the web client's component
        io.input.email('What is your email?'),
      ])
      return `Hello ${name}! Your email is ${email}.`
    },
  },
})

interval.listen()
