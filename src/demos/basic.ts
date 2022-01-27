import createIntervalHost from '../index'
import editEmailForUser from './editEmail'
import { sleep } from './helpers'

createIntervalHost({
  apiKey: '24367604-b35f-4b89-81bc-7d1cf549ba60',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3001',
  actions: {
    'Progress through long list': async io => {
      const resp = await io.experimental.progressThroughList(
        ['Dan', 'Alex', 'Jacob'],
        async person => {
          await sleep(1000)
          return `Hi, ${person}!`
        },
        { label: 'Here are some items' }
      )

      console.log('done!', resp)
    },
    'No interactive elements': async io => {
      io.display.heading({ label: 'I do nothing :(' }).then(() => {})
      console.log('done!')
    },
    'Unique ID tester': async io => {
      await io.input.number({ label: 'hi' })

      const [name, id] = await io.renderGroup([
        io.input.text({ label: 'Your name' }),
        io.input.number({ label: 'Pick a number' }),
      ])
    },
    'Hello current user': async (io, ctx) => {
      io.display
        .heading({
          label: `Hello, ${ctx.user.firstName} ${ctx.user.lastName}`,
        })
        .then(() => {})
    },
    'Update email for user': editEmailForUser,
  },
})
