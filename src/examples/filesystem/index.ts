import path from 'path'
import Interval from '../../experimental'

const interval = new Interval({
  apiKey: 'alex_dev_Bku6kYZlyhyvkCO36W5HnpwtXACI1khse8SnZ9PuwsmqdRfe',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routesDirectory: path.resolve(__dirname, 'routes'),
})

interval.listen()
