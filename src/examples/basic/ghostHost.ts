import Interval from '../..'

const anon = new Interval({
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    hello_world: async io => {
      const name = await io.input.text('Your name')
      return { greeting: `Hello, ${name}` }
    },
  },
}).listen()

export default anon
