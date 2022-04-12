import Interval, { IOError } from '../../index'
import editEmailForUser from './editEmail'
import { fakeDb, mapToIntervalUser, sleep } from '../utils/helpers'
import { table_basic, table_custom_columns } from './selectFromTable'
import unauthorized from './unauthorized'

const prod = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    ImportUsers: async io => {
      console.log("I'm a live mode action")
      const name = await io.input.text('Enter the name for a user')
      return { name }
    },
    enter_two_numbers: async io => {
      const num1 = await io.input.number('Enter a number')

      try {
        const num2 = await io.input.number(
          `Enter a second number that's greater than ${num1}`,
          {
            min: num1 + 0.01,
            decimals: 2,
          }
        )

        return { num1, num2 }
      } catch (err) {
        if (err instanceof IOError) {
          // Do some long cleanup work
          await sleep(num1 * 1000)

          return {
            'Cleanup time': `${num1} seconds`,
            'Cleanup completed': new Date(),
          }
        }

        // Other error in host code
        throw new Error('Something bad happened!')
      }
    },
    enter_one_number: async (io, ctx) => {
      ctx.log('Requesting a number')
      const num = await io.input.number('Enter a number')
      ctx.log('Received', num)

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
  endpoint: 'ws://localhost:3000/websocket',
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
    optional_values: async io => {
      const [name, num, color] = await io.group([
        io.input.text('Your name'),
        io.input.number('Pick a number').optional(),
        io.select
          .single('Your favorite color', {
            options: [
              {
                label: 'Red',
                value: 'red',
              },
              {
                label: 'Blue',
                value: 'blue',
              },
              {
                label: 'Orange',
                value: 'orange',
              },
            ],
          })
          .optional(),
      ])

      return {
        Name: name,
        Number: num ?? 'No number selected',
        'Favorite color': color?.label ?? 'Unknown',
      }
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
    enter_two_numbers: async io => {
      const num1 = await io.input.number('Enter a number')

      const num2 = await io.input.number(
        `Enter a second number that's greater than ${num1}`,
        {
          min: num1 + 0.01,
          decimals: 2,
        }
      )

      return { num1, num2, sum: num1 + num2 }
    },
    logTest: async (io, ctx) => {
      ctx.log(new Date().toUTCString())
      const name = await io.input.text('Your name')
      ctx.log(new Date().toUTCString())
      const email = await io.input.email('Your email')

      ctx.log('Received', { name, email })

      ctx.log('Data types: ', true, null, undefined, [1, 2, 3], {
        a: 1,
        b: '2',
      })

      return { name, email }
    },
    confirmBeforeDelete: async (io, ctx) => {
      const email = await io.input.email('Enter an email address')

      const didDelete = await io.confirm(`Delete this user?`, {
        helpText: 'All of their data will be removed.',
      })

      await sleep(500)
      ctx.log('Deleted 1 subscription')
      await sleep(500)
      ctx.log(`Deleted ${Math.floor(Math.random() * 100)} post drafts`)
      await sleep(500)
      ctx.log('Skipped 13 published posts')
      await sleep(1500)
      ctx.log('Deleted 13 comments')

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
    dates: async io => {
      const [date, time, datetime] = await io.group([
        io.experimental.date('Enter a date'),
        io.experimental.time('Enter a time'),
        io.experimental.datetime('Enter a datetime'),
        io.input.text('Text input'),
      ])

      await io.display.object('Result', { data: { date, time, datetime } })

      return datetime
    },
    optionalCheckboxes: async io => {
      const options = [
        {
          value: 'A',
          label: 'A',
          extraData: 'A',
        },
        {
          value: 'B',
          label: 'B',
          extraData: 'B',
        },
        {
          value: 'C',
          label: 'C',
          extraData: 'C',
        },
      ]

      let r = await io.select.multiple('Select zero or more', {
        options,
      })

      console.log(r)

      r = await io.select.multiple(
        'Modify the selection, selecting between 1 and 2',
        {
          options,
          defaultValue: r,
          minSelections: 1,
          maxSelections: 2,
        }
      )

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
    echoParams: async (_, ctx) => {
      console.log(ctx.params)
      return ctx.params
    },
    invalid_props: async io => {
      await io.select.single('This is broken', {
        options: [
          { label: 'Works', value: 'works' },
          // @ts-expect-error
          { label: "Doesn't" },
        ],
      })
    },
    error: async io => {
      class CustomError extends Error {
        name = 'CustomError'
      }

      const errors = [
        new Error('This is a regular error'),
        new TypeError('This is a type error.'),
        new CustomError('This is a custom error!'),
      ]

      const selected = await io.select.single('Select an error', {
        options: errors.map((e, i) => ({ label: e.name, value: i.toString() })),
      })

      throw errors[Number(selected.value)]
    },
    actionLinks: async io => {
      await io.group([
        io.display.table('In a table!', {
          data: [
            { slug: undefined },
            { slug: 'noInteractiveElements' },
            {
              slug: 'helloCurrentUser',
              params: { message: 'Hi from a table!' },
            },
          ],
          columns: [
            {
              label: 'Action slug',
              render: row => row.slug,
            },
            {
              label: 'Link',
              render: row => ({
                label: row.slug ?? '(undefined)',
                action: row.slug,
                params: row.params,
              }),
            },
          ],
        }),
        io.display.link('External link', {
          href: 'https://example.com',
        }),
        io.display.link('Action link', {
          action: 'helloCurrentUser',
          params: {
            message: 'From a button!',
          },
        }),
      ])
    },
  },
})

interval.listen()
