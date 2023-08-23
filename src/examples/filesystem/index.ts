import path from 'path'
import Interval from '../..'
import env from '../../env'

const interval = new Interval({
  apiKey: env.DEMO_API_KEY,
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routesDirectory: path.resolve(__dirname, 'routes'),
})

interval.listen()
