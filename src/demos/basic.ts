import Interval from '../index'
import editEmailForUser from './editEmail'
import { fakeDb, mapToIntervalUser, sleep } from './helpers'
import unauthorized from './unauthorized'

const intervalLiveMode = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  endpoint: 'ws://localhost:3002',
  actions: {
    ImportUsers: async io => {
      console.log("I'm a live mode action")
      const name = await io.input.text('Enter the name for a user')
      return { name }
    },
  },
}).listen()

const interval = new Interval({
  apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3002',
  actions: {
    'progress-through-long-list': async io => {
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
    noInteractiveElements: async io => {
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
    'unauthorized-error': unauthorized,
    enter_a_number: async io => {
      const num = await io.input.number('Enter a number')

      await io.input.number(
        `Enter a second number that's greater than ${num}`,
        {
          min: num + 1,
        }
      )
    },
    helloCurrentUser: async (io, ctx) => {
      console.log(ctx.params)

      let heading = `Hello, ${ctx.user.firstName} ${ctx.user.lastName}`

      if (ctx.params.message) {
        heading += ` (Message: ${ctx.params.message})`
      }

      io.display.heading(heading).then(() => {})
    },
    optionalCheckboxes: async io => {
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
    update_email_for_user: editEmailForUser,
    'Enter email body': async io => {
      const body = await io.input.richText('Enter email body', {
        helpText: 'This will be sent to the user.',
      })

      await io.display.markdown(`
          ## You entered:

          ~~~html
          ${body}
          ~~~
      `)
    },
    ImportUsers: async io => {
      const records = await io.experimental.spreadsheet(
        'Select users to import',
        {
          columns: {
            firstName: 'string',
            lastName: 'string',
            age: 'number?',
            'Is cool': 'boolean',
          },
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
    'Display-Returns-Automatically': async io => {
      await io.renderGroup([
        io.display.markdown(`
          After you press continue, a long running task will start.
        `),
        io.input.text('Your name'),
      ])

      console.log(1)

      await io.display.heading('Submitted!')

      console.log(2)

      await sleep(10_000)
      console.log('Done!')
    },
    Render_markdown: async io => {
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
    Progress_steps: async io => {
      await io.experimental.progress.indeterminate('Fetching users...')

      const users = await fakeDb
        .find('')
        .then(res => res.map(mapToIntervalUser))

      let completed = 1
      for (const u of users) {
        await io.experimental.progress.steps('Exporting users', {
          subTitle: "We're exporting all users. This may take a while.",
          currentStep: u.name,
          steps: { completed, total: users.length },
        })
        await sleep(1000)
        completed += 1
      }
    },
  },
})

interval.listen()

/*
setTimeout(async () => {
  await interval.actions.enqueue('Hello current user', {
    assignee: 'alex@interval.com',
    params: {
      message: 'Hello, queue!',
    },
  })

  const queuedAction = await interval.actions.enqueue('Hello current user', {
    params: {
      message: 'Hello, anyone!',
    },
  })

  await interval.actions.dequeue(queuedAction.id)
}, 1000)
*/
