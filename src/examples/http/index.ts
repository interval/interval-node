import { createHttpServer } from '../../index'

const server = createHttpServer({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    hello_http: async () => {
      return 'Hello, from HTTP!'
    },
  },
})

const port = process.env.PORT ? Number(process.env.PORT) : 5000

server.listen(port)

console.log(`Listening on http://localhost:${port}`)
