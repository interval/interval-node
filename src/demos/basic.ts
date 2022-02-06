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
    'Optional checkboxes': async io => {
      const options = [
        {
          value: 'A',
          label: 'A',
        },
        {
          value: 'B',
          label: 'B',
        },
        {
          value: 'C',
          label: 'C',
        },
      ]

      let r = await io.select.multiple('Select zero or more', {
        options,
      })

      console.log(r)

      r = await io.select.multiple('Optionally modify the selection', {
        options,
        defaultValue: [
          {
            value: 'A',
            label: 'A',
          },
          {
            value: 'C',
            label: 'C',
          },
        ],
      })

      console.log(r)
    },
    'Update email for user': editEmailForUser,
    'Render markdown': async io => {
      await io.renderGroup([
        io.display.markdown(`
          ## User data deletion
          **Warning:** this _will_ erase user data.
          You can read more about this [here](https://google.com).
        `),
        io.select.multiple('Erase user data', {
          options: [
            {
              label: 'Erase',
              value: 'erase',
            },
          ],
        }),
      ])
    },
  },
})
