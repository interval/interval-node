import Interval from '../..'

const anon = new Interval({
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    hello_world: async (io, ctx) => {
      const name = await io.input.text('Your name').optional()
      return {
        greeting: `Hello, ${name || ctx.user.firstName || ctx.user.email}`,
      }
    },
  },
}).listen()

export default anon
