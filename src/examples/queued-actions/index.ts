import Interval from '../../index'
import env from '../../env'

const interval = new Interval({
  apiKey: env.DEMO_API_KEY,
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes: {
    helloCurrentUser: async (io, ctx) => {
      console.log(ctx.params)

      let heading = `Hello, ${ctx.user.firstName} ${ctx.user.lastName}`

      if (ctx.params.message) {
        heading += ` (Message: ${ctx.params.message})`
      }

      await io.display.heading(heading)
    },
  },
})

interval.listen()

setTimeout(async () => {
  await interval.enqueue('helloCurrentUser', {
    assignee: 'alex@interval.com',
    params: {
      message: 'Hello, queue!',
    },
  })

  const queuedAction = await interval.enqueue('helloCurrentUser', {
    params: {
      message: 'Hello, anyone!',
    },
  })

  await interval.dequeue(queuedAction.id)
}, 1000)
