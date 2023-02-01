import http from 'http'
import Interval, { Page, Layout, io } from '../../experimental'
import { asyncTable } from '../utils/ioMethodWrappers'

const interval = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes: {
    hello_http: async io => {
      const message = await io.input.text('Enter a message')
      return `"${message}", from HTTP!`
    },
    hello_http_pages: new Page({
      name: 'Hello, HTTP pages!',
      handler: async () => {
        return new Layout({
          title: 'Inside a page via HTTP',
          children: [asyncTable(500)],
        })
      },
      routes: {
        sub_action: async () => {
          return 'Hello, from a sub action!'
        },
      },
    }),
  },
})

const port = process.env.PORT ? Number(process.env.PORT) : 5000

const server = http.createServer(interval.httpRequestHandler)

server.listen(port)

console.log(`Listening on http://localhost:${port}`)
