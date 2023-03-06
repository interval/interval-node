import Interval from '../../index'
import { sleep } from '../utils/helpers'

const interval = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes: {
    wait_a_while: async (io, ctx) => {
      await ctx.loading.start('Waiting...')
      await sleep(5000)
      return 'Done!'
    },
  },
})

interval.listen()

process.on('SIGINT', () => {
  interval
    .gracefullyShutdown()
    .then(() => {
      console.log('Shut down!')
      process.exit(0)
    })
    .catch(err => {
      console.error(
        'Failed shutting down gracefully, forcibly closing connection'
      )
      interval.close()
      process.exit(0)
    })
})
