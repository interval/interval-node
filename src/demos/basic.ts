import Interval from '../index'
import editEmailForUser from './editEmail'
import { fakeDb, mapToIntervalUser, sleep } from './helpers'
import { table_basic, table_custom_columns } from './selectFromTable'
import unauthorized from './unauthorized'

const prod = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  endpoint: 'ws://localhost:3002',
  actions: {
    ImportUsers: async io => {
      console.log("I'm a live mode action")
      const name = await io.input.text('Enter the name for a user')
      return { name }
    },
    enter_two_numbers: async io => {
      const num1 = await io.input.number('Enter a number')

      const num2 = await io.input.number(
        `Enter a second number that's greater than ${num1}`,
        {
          min: num1 + 1,
        }
      )

      return { num1, num2 }
    },
    enter_one_number: async io => {
      const num = await io.input.number('Enter a number')

      return { num }
    },
    echoParams: async (_, ctx) => {
      console.log(ctx.params)
      return ctx.params
    },
  },
})

prod.listen()

const interval = new Interval({
  apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3002',
  actions: {
    'long-return-string': async io => {
      return {
        date: new Date(),
        url: 'http://chart.apis.google.com/chart?chs=500x500&chma=0,0,100,100&cht=p&chco=FF0000%2CFFFF00%7CFF8000%2C00FF00%7C00FF00%2C0000FF&chd=t%3A122%2C42%2C17%2C10%2C8%2C7%2C7%2C7%2C7%2C6%2C6%2C6%2C6%2C5%2C5&chl=122%7C42%7C17%7C10%7C8%7C7%7C7%7C7%7C7%7C6%7C6%7C6%7C6%7C5%7C5&chdl=android%7Cjava%7Cstack-trace%7Cbroadcastreceiver%7Candroid-ndk%7Cuser-agent%7Candroid-webview%7Cwebview%7Cbackground%7Cmultithreading%7Candroid-source%7Csms%7Cadb%7Csollections%7Cactivity|Chart',
        something:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed sit amet quam in lorem sagittis accumsan malesuada nec mauris. Nulla cursus dolor id augue sodales, et consequat elit mattis. Suspendisse nec sollicitudin ex. Pellentesque laoreet nulla nec malesuada consequat. Donec blandit leo id tincidunt tristique. Mauris vehicula metus sed ex bibendum, nec bibendum urna tincidunt. Curabitur porttitor euismod velit sed interdum. Suspendisse at dapibus eros. Vestibulum varius, est vel luctus pellentesque, risus lorem ullamcorper est, a ullamcorper metus dolor eget neque. Donec sit amet nulla tempus, fringilla magna eu, bibendum tortor. Nam pulvinar diam id vehicula posuere. Praesent non turpis et nibh dictum suscipit non nec ante. Phasellus vulputate egestas nisl a dapibus. Duis augue lorem, mattis auctor condimentum a, convallis sed elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Pellentesque bibendum, magna vel pharetra fermentum, eros mi vulputate enim, in consectetur est quam quis felis.',
      }
    },
    table_basic,
    table_custom_columns,
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
      await io.display.heading('I block :(')
      console.log('done!')
    },
    'Unique ID tester': async io => {
      await io.input.number('Hi')

      const [name, id] = await io.group([
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
    confirmBeforeDelete: async io => {
      const email = await io.input.email('Enter an email address')

      const didDelete = await io.confirm(`Delete this user?`, {
        helpText: 'All of their data will be removed.',
      })

      return { didDelete, email }
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
    enter_email_body: async io => {
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
    'Display-Does-Not-Return-Automatically': async io => {
      await io.group([
        io.display.markdown(`
          After you press continue, a long running task will start.
        `),
        io.input.text('Your name'),
      ])

      console.log(1)

      await io.display.heading('Blocking until you press continue')

      await sleep(2000)

      io.display
        .markdown(`Can still hack immedate returns with \`.then()\``)
        .then(() => {})

      await sleep(2000)

      io.display.markdown('See!').then(() => {})

      console.log(2)

      await sleep(2000)
      console.log('Done!')
    },
    Render_markdown: async io => {
      await io.group([
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
    Render_object: async io => {
      await io.group([
        io.display.object('User', {
          data: {
            name: 'Interval',
            action: { isTrue: true, createdAt: new Date() },
          },
        }),
        io.select.multiple('Continue?', {
          options: [
            {
              label: 'Continue',
              value: 'Continue',
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

setTimeout(async () => {
  await prod.actions.enqueue('enter_one_number')

  await prod.actions.enqueue('echoParams', {
    params: {
      true: true,
      false: false,
      number: 1337,
      string: 'string',
      date: new Date(),
      null: null,
      undefined: undefined,
    },
  })
  await prod.actions.enqueue('echoParams', {
    params: {
      firstName: 'A rather long string',
      address: 'Some place, somewhere',
    },
  })
  await prod.actions.enqueue('echoParams', {
    params: {
      number: 1337,
      string: 'string',
      null: null,
      undefined: undefined,
    },
  })
  await prod.actions.enqueue('echoParams', {
    params: {
      number: 1337,
    },
  })

  await interval.actions.enqueue('helloCurrentUser', {
    assignee: 'alex@interval.com',
    params: {
      message: 'Hello, queue!',
    },
  })

  const queuedAction = await interval.actions.enqueue('helloCurrentUser', {
    params: {
      message: 'Hello, anyone!',
    },
  })

  await interval.actions.dequeue(queuedAction.id)
}, 1000)
