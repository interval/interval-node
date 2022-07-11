import http from 'http'
import Interval from '../../experimental'

const interval = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    hello_http: async io => {
      const message = await io.input.text('Enter a message')
      return `"${message}", from HTTP!`
    },
  },
})

const port = process.env.PORT ? Number(process.env.PORT) : 5000

const server = http.createServer(interval.httpRequestHandler)

server.listen(port)

console.log(`Listening on http://localhost:${port}`)
