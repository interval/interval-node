import createIntervalHost from '../index'
import editEmailForUser from './editEmail'
import { sleep } from './helpers'

createIntervalHost({
  apiKey: '24367604-b35f-4b89-81bc-7d1cf549ba60',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3002',
  actions: {
    'Progress through long list': async io => {
      const resp = await io.experimental.progressThroughList(
        'Here are some items',
        ['Dan', 'Alex', 'Jacob'],
        async person => {
          await sleep(1000)
          return `Hi, ${person}!`
        }
      )

      console.log('done!', resp)
    },
    'No interactive elements': async io => {
      io.display.heading('I do nothing :(').then(() => {})
      console.log('done!')
    },
    'Unique ID tester': async io => {
      await io.input.number('Hi')

      const [name, id] = await io.renderGroup([
        io.input.text('Your name'),
        io.input.number('Pick a number'),
      ])
    },
    'Hello current user': async (io, ctx) => {
      io.display
        .heading(`Hello, ${ctx.user.firstName} ${ctx.user.lastName}`)
        .then(() => {})
    },
    'Update email for user': editEmailForUser,
    'Import users': async io => {
      const records = await io.experimental.spreadsheet(
        'Select users to import',
        {
          columns: [
            'firstName',
            'lastName',
            { name: 'age', type: 'number?' },
            { name: 'Is cool', type: 'boolean' },
          ],
        }
      )

      await io.experimental.progressThroughList(
        'Importing users...',
        records.map(r => `${r.firstName} ${r.lastName}`),
        async name => {
          await sleep(1000)
          return `Added ${name}!`
        }
      )
    },
  },
})
