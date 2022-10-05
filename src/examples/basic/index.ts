import Interval, { IOError, io, ctx } from '../../index'
import IntervalClient from '../../classes/IntervalClient'
import {
  IntervalActionHandler,
  NotificationDeliveryInstruction,
} from '../../types'
import editEmailForUser from './editEmail'
import { fakeDb, mapToIntervalUser, sleep } from '../utils/helpers'
import * as table_actions from './table'
import unauthorized from './unauthorized'
import './ghostHost'
import { generateS3Urls } from '../utils/upload'
import fs from 'fs'
import { Router } from '../../experimental'

const actionLinks: IntervalActionHandler = async () => {
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
          renderCell: row => row.slug,
        },
        {
          label: 'Link',
          renderCell: row => ({
            label: row.slug ?? '(undefined)',
            action: row.slug,
            params: row.params,
          }),
        },
      ],
    }),
    io.display.link('External link', {
      url: 'https://example.com',
    }),
    io.display.link('Action link', {
      action: 'helloCurrentUser',
      params: {
        message: 'From a button!',
      },
    }),
    io.display.link('This same action', {
      action: 'actionLinks',
      params: {
        prevActionAt: new Date().toISOString(),
      },
    }),
  ])
}

const prod = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  endpoint: 'ws://localhost:3000/websocket',
  routes: {
    actionLinks,
    ImportUsers: {
      backgroundable: true,
      name: 'Import users',
      description: "Doesn't actually import users",
      handler: async io => {
        console.log("I'm a live mode action")
        const name = await io.input.text('Enter the name for a user')
        return { name }
      },
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
      ctx.log('Received 1', num)
      ctx.log('Received 2', num)
      ctx.log('Received 3', num)

      return { num }
    },
    echoParams: async (io, ctx) => {
      ctx.log(ctx.params)
      await io.display.object('Params', {
        data: ctx.params,
      })
      return ctx.params
    },
    perform_redirect_flow: async () => {
      let startedWork = false
      const { workDone = false } = ctx.params
      if (!workDone) {
        await ctx.redirect({
          action: 'perform_common_work',
        })
        startedWork = true
      }

      console.log({ startedWork, workDone })

      return {
        startedWork,
        workDone,
      }
    },
    perform_common_work: async () => {
      ctx.loading.start(
        'Performing some work, will redirect back when complete'
      )
      await sleep(2000)
      await ctx.redirect({
        action: 'perform_redirect_flow',
        params: {
          workDone: true,
        },
      })
    },
  },
})

prod.listen()

const interval = new Interval({
  apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes: {
    disabled_inputs: async io => {
      await io.group([
        io.display.heading('Here are a bunch of disabled inputs'),
        io.input.text('Text input', {
          disabled: true,
          placeholder: 'Text goes here',
        }),
        io.input.datetime('Date & time', { disabled: true }),
        io.input.boolean('Boolean input', { disabled: true }),
        io.select.single('Select something', {
          options: [1, 2, 3],
          disabled: true,
        }),
        io.input.number('Number input', {
          disabled: true,
        }),
        io.input.email('Email input', { disabled: true }),
        io.input.richText('Rich text input', { disabled: true }),
        io.search('Search for a user', {
          disabled: true,
          renderResult: user => ({
            label: user.name,
            description: user.email,
          }),
          onSearch: async query => {
            return [
              {
                name: 'John Doe',
                email: 'johndoe@example.com',
              },
            ]
          },
        }),
        io.select.multiple('Select multiple of something', {
          options: [1, 2, 3],
          disabled: true,
        }),
        io.select.table('Select from table', {
          data: [
            {
              album: 'Exile on Main Street',
              artist: 'The Rolling Stones',
              year: 1972,
            },
            {
              artist: 'Michael Jackson',
              album: 'Thriller',
              year: 1982,
            },
            {
              album: 'Enter the Wu-Tang (36 Chambers)',
              artist: 'Wu-Tang Clan',
              year: 1993,
            },
          ],
          disabled: true,
        }),
        io.input.date('Date input', { disabled: true }),
        io.input.time('Time input', { disabled: true }),
        io.experimental.input.file('File input', { disabled: true }),
      ])

      return 'Done!'
    },
    'long-return-string': async io => {
      return {
        date: new Date(),
        url: 'http://chart.apis.google.com/chart?chs=500x500&chma=0,0,100,100&cht=p&chco=FF0000%2CFFFF00%7CFF8000%2C00FF00%7C00FF00%2C0000FF&chd=t%3A122%2C42%2C17%2C10%2C8%2C7%2C7%2C7%2C7%2C6%2C6%2C6%2C6%2C5%2C5&chl=122%7C42%7C17%7C10%7C8%7C7%7C7%7C7%7C7%7C6%7C6%7C6%7C6%7C5%7C5&chdl=android%7Cjava%7Cstack-trace%7Cbroadcastreceiver%7Candroid-ndk%7Cuser-agent%7Candroid-webview%7Cwebview%7Cbackground%7Cmultithreading%7Candroid-source%7Csms%7Cadb%7Csollections%7Cactivity|Chart',
        something:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed sit amet quam in lorem sagittis accumsan malesuada nec mauris. Nulla cursus dolor id augue sodales, et consequat elit mattis. Suspendisse nec sollicitudin ex. Pellentesque laoreet nulla nec malesuada consequat. Donec blandit leo id tincidunt tristique. Mauris vehicula metus sed ex bibendum, nec bibendum urna tincidunt. Curabitur porttitor euismod velit sed interdum. Suspendisse at dapibus eros. Vestibulum varius, est vel luctus pellentesque, risus lorem ullamcorper est, a ullamcorper metus dolor eget neque. Donec sit amet nulla tempus, fringilla magna eu, bibendum tortor. Nam pulvinar diam id vehicula posuere. Praesent non turpis et nibh dictum suscipit non nec ante. Phasellus vulputate egestas nisl a dapibus. Duis augue lorem, mattis auctor condimentum a, convallis sed elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Pellentesque bibendum, magna vel pharetra fermentum, eros mi vulputate enim, in consectetur est quam quis felis.',
      }
    },
    // 'progress-through-long-list': async io => {
    //   const resp = await io.experimental.progressThroughList(
    //     'Here are some items',
    //     ['Dan', 'Alex', 'Jacob'],
    //     async person => {
    //       await sleep(1000)
    //       return `Hi, ${person}!`
    //     }
    //   )
    //
    //   console.log('done!', resp)
    // },
    noInteractiveElements: async io => {
      await io.display.heading('I block :(')
      console.log('done!')
    },
    dynamic_group: async io => {
      const promises = [
        io.input.text('Your name'),
        io.input.number('Pick a number').optional(),
      ]

      const resp = await io.group(promises)

      console.log(resp)

      const obj = {
        text: io.input.text('Text'),
        num: io.input.number('Number'),
      }

      const objResp = await io.group(obj)
    },
    object_group: async io => {
      const resp = await io.group({
        name: io.input.text('Name'),
        email: io.input.email('Email'),
        num: io.input.number('Number').optional(),
        _disp: io.display.markdown('---'),
      })

      const { name, email, num } = resp

      return {
        name,
        email,
        num,
      }
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
    bare_string_return: async () => {
      return 'Hello, Interval!'
    },
    bare_list_return: async io => {
      return await io.group([
        io.input.text('Text'),
        io.input.number('Number'),
        io.input.boolean('Boolean'),
      ])
    },
    petr_repro: async () => {
      // Data will be undefined if you just click "continue" without modifying the form.
      const data = await io.select.single('Some field', {
        options: [],
        defaultValue: { label: 'my label', value: 'my_value' },
      })

      // This should be an object equal to the defaultValue
      console.log('data', data)

      await io.display.object('Return', {
        data: { mySuperValue: data || 'No data' },
      })
    },
    code: async () => {
      await io.group([
        io.display.code('Code from string', {
          code: 'console.log("Hello, world!")',
          language: 'typescript',
        }),
        io.display.code('Code from file', {
          code: fs.readFileSync('./src/examples/utils/helpers.ts', {
            encoding: 'utf8',
          }),
        }),
      ])
    },
    images: async () => {
      await io.group([
        io.display.image('Image via url', {
          url: 'https://media.giphy.com/media/26ybw6AltpBRmyS76/giphy.gif',
          alt: "Man makes like he's going to jump on a skateboard but doesn't",
          width: 'medium',
        }),
        io.display.image('Image via buffer', {
          buffer: fs.readFileSync('./src/examples/static/fail.gif'),
          alt: 'Wile E. Coyote pulls a rope to launch a boulder from a catapult but it topples backwards and crushes him',
        }),
      ])
    },
    videos: async () => {
      await io.group([
        io.display.video('Video via url', {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/The_Kid_scenes.ogv',
          size: 'large',
          muted: true,
        }),
        io.display.video('Video via buffer', {
          loop: true,
          buffer: fs.readFileSync('./src/examples/static/canyon.mp4'),
          size: 'large',
        }),
      ])
    },
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

      const itemsInQueue = 100
      await ctx.loading.start({
        itemsInQueue,
      })

      for (let i = 0; i < itemsInQueue; i++) {
        await sleep(100)
        ctx.log(i)
        await ctx.loading.completeOne()
        await ctx.notify({
          title: `Item ${i}`,
          message: `Hello, ${name}!`,
          delivery: [{ to: email }],
        })
      }

      return { name, email }
    },
    confirmBeforeDelete: async (io, ctx) => {
      const email = await io.input.email('Enter an email address')

      const shouldDelete = await io.confirm(`Delete this user?`, {
        helpText: 'All of their data will be removed.',
      })

      if (!shouldDelete) {
        ctx.log('Canceled by user')
        return
      }

      await sleep(500)
      await sleep(500)
      ctx.log(`Deleted ${Math.floor(Math.random() * 100)} post drafts`)
      await sleep(500)
      ctx.log('Skipped 13 published posts')
      await sleep(1500)
      ctx.log('Deleted 13 comments')

      return { email }
    },
    helloCurrentUser: {
      name: 'Hello, current user!',
      description: '👋',
      handler: async () => {
        console.log(ctx.params)

        let heading = `Hello, ${ctx.user.firstName} ${ctx.user.lastName}`

        if (ctx.params.message) {
          heading += ` (Message: ${ctx.params.message})`
        }

        return heading
      },
    },
    dates: async io => {
      const [date, time, datetime] = await io.group([
        io.input.date('Enter a date', {
          min: {
            year: 2020,
            month: 1,
            day: 1,
          },
          max: {
            year: 3000,
            month: 12,
            day: 30,
          },
        }),
        io.input.time('Enter a time', {
          min: {
            hour: 8,
            minute: 30,
          },
          max: {
            hour: 20,
            minute: 0,
          },
        }),
        io.input.datetime('Enter a datetime', {
          defaultValue: new Date(),
          min: new Date(),
        }),
        io.input.text('Text input'),
      ])

      await io.display.object('Result', { data: { date, time, datetime } })

      return datetime
    },
    validityTester: async io => {
      await io
        .group([
          io.input.number('Enter a number'),
          io.input.number('Enter a second number').optional(),
          io.input
            .text('First name', {
              maxLength: 20,
            })
            .validate(async result => {
              await sleep(2000)
              if (result !== 'Jacob') return 'Must be Jacob.'
            }),
          io.input
            .text('Last name', {
              minLength: 5,
            })
            .optional(),
          io.input.email('Email'),
          io.input.email('Backup email').optional(),
        ])
        .validate(([, , firstName, lastName]) => {
          if (lastName === undefined && firstName === 'Jacob') return
          if (firstName === 'Jacob' && lastName !== 'Mischka') {
            return 'Last name is not correct.'
          }
        })
    },
    optionalCheckboxes: async io => {
      const options = [
        {
          value: 0,
          label: 0,
          extraData: 'A',
        },
        {
          value: new Date(2022, 6, 1),
          label: new Date(2022, 6, 1),
          extraData: 'B',
        },
        {
          value: true,
          label: true,
          extraData: 'C',
        },
      ]

      const defaultValue = await io.select.multiple('Select zero or more', {
        options,
      })

      ctx.log(defaultValue)

      const selected = await io.select
        .multiple('Modify the selection, selecting between 1 and 2', {
          options,
          defaultValue,
          minSelections: 1,
          maxSelections: 2,
        })
        .optional()

      ctx.log(selected)
    },
    update_email_for_user: editEmailForUser,
    enter_email_body: async io => {
      const body = await io.input.richText('Enter email body', {
        defaultValue: '<h2>Welcome to Interval!</h2><p>Enjoy your stay.</p>',
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
      await io.display.table('Users', {
        data: [
          {
            email: 'carsta.rocha@example.com',
            phone_number: '(60) 1416-4953',
            birthdate: '1993-08-04',
            first_name: 'carsta',
            last_name: 'rocha',
            photo: 'photos/21351234.jpg',
            website_url: 'https://example.com',
          },
          {
            email: 'irene.morales@example.org',
            phone_number: '625-790-958',
            birthdate: '1982-04-28',
            first_name: 'irene',
            last_name: 'morales',
            picture: 'photos/8321527.jpg',
            website_url: 'https://example.org',
          },
        ],
        columns: [
          {
            label: 'Name',
            renderCell: row => `${row.first_name} ${row.last_name}`,
          },
          {
            label: 'Birth date',
            renderCell: row => {
              const [y, m, d] = row.birthdate.split('-').map(s => Number(s))
              const birthDate = new Date(y, m - 1, d)
              return {
                label: birthDate.toLocaleDateString(),
                value: birthDate,
              }
            },
          },
          {
            label: 'Website',
            renderCell: row => ({
              label: row.website_url,
              url: row.website_url,
            }),
          },
          {
            label: 'Edit action',
            renderCell: row => ({
              label: 'Edit user',
              action: 'edit_user',
              params: {
                email: row.email,
              },
            }),
          },
        ],
        orientation: 'horizontal',
      })
    },
    edit_user: async (io, ctx) => {
      const { email } = ctx.params
      await io.display.markdown(
        `Perform work for the user with the email \`${email}\``
      )
      return { email }
      // const user = lookupUserByEmail(email)
      // Edit user
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
    Progress_steps: async (io, ctx) => {
      await ctx.loading.start('Fetching users...')

      await sleep(1000)

      const users = await fakeDb
        .find('')
        .then(res => res.map(mapToIntervalUser))

      await io.display.heading('Press continue when ready')

      await ctx.loading.start({
        title: 'Exporting users',
        description: "We're exporting all users. This may take a while.",
        itemsInQueue: users.length,
      })
      for (const _ of users) {
        await sleep(1000)
        await ctx.loading.completeOne()
      }

      await ctx.loading.start('Finishing up...')

      await sleep(1000)
    },
    loading_dos: async () => {
      const itemsInQueue = 100_000
      await ctx.loading.start({
        title: 'Migrating users',
        description: 'There are a lot, but they are very fast',
        itemsInQueue,
      })

      for (let i = 0; i < itemsInQueue; i++) {
        await ctx.loading.completeOne()
      }
    },
    log_dos: async () => {
      for (let i = 0; i < 1000; i++) {
        await ctx.log(i)
      }
    },
    echoParams: async (io, ctx) => {
      ctx.log(ctx.params)
      await io.display.object('Params', {
        data: ctx.params,
      })
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
    money: async io => {
      const [usd, eur, jpy] = await io.group([
        io.input.number('United States Dollar', {
          min: 10,
          currency: 'USD',
        }),
        io.input.number('Euro', {
          currency: 'EUR',
        }),
        io.input.number('Japanese yen', {
          currency: 'JPY',
          decimals: 3,
        }),
      ])

      return { usd, eur, jpy }
    },
    actionLinks,
    globalIO: async () => {
      await io.display.markdown(`Hello from \`${ctx.action.slug}!\``)
    },
    notifications: async (io, ctx) => {
      let deliveries: NotificationDeliveryInstruction[] = []

      while (true) {
        const [_heading, to, method, moreDeliveries] = await io.group([
          io.display.heading("Let's send a notification"),
          io.input.text('to'),
          io.select
            .single('method', {
              options: [
                { label: 'SLACK', value: 'SLACK' },
                { label: 'EMAIL', value: 'EMAIL' },
              ],
            })
            .optional(),
          io.input.boolean('Send to another destination?'),
        ])
        deliveries.push({
          to,
          method: method?.value as 'SLACK' | 'EMAIL' | undefined,
        })
        ctx.log('Current delivery array:', deliveries)

        if (!moreDeliveries) break
      }

      const [message, title] = await io.group([
        io.input.text('What message would you like to send?'),
        io.input
          .text('Optionally provide a title', {
            helpText: 'This will otherwise default to the name of the action',
          })
          .optional(),
      ])

      await ctx.notify({
        message,
        title,
        delivery: deliveries,
      })

      return { message: 'OK, notified!' }
    },
    upload: async (io, ctx) => {
      const customDestinationFile = await io.experimental.input.file(
        'Upload an image!',
        {
          helpText: 'Will be uploaded to the custom destination.',
          allowedExtensions: ['.gif', '.jpg', '.jpeg', '.png'],
          generatePresignedUrls: async ({ name }) => {
            const urlSafeName = name.replace(/ /g, '-')
            const path = `custom-endpoint/${new Date().getTime()}-${urlSafeName}`

            return generateS3Urls(path)
          },
        }
      )

      console.log(await customDestinationFile.url())

      const file = await io.experimental.input.file('Upload an image!', {
        helpText:
          'Will be uploaded to Interval and expire after the action finishes running.',
        allowedExtensions: ['.gif', '.jpg', '.jpeg', '.png'],
      })

      console.log(file)

      const { text, json, buffer, url, ...rest } = file

      return {
        ...rest,
        url: await url(),
        text: rest.type.includes('text/')
          ? await text().catch(err => {
              console.log('Invalid text', err)
              return undefined
            })
          : undefined,
        json: rest.type.includes('text/')
          ? await json()
              .then(obj => JSON.stringify(obj))
              .catch(err => {
                console.log('Invalid JSON', err)
                return undefined
              })
          : undefined,
      }
    },
    advanced_data: async io => {
      const data = {
        bigInt: BigInt(5),
        map: new Map([
          ['a', 1],
          ['b', 2],
        ]),
        set: new Set(['a', 'b', 'c']),
      }

      await io.display.object('Object', {
        data,
      })

      return data.bigInt
    },
    malformed: async io => {
      // @ts-expect-error: Ensuring we can handle invalid calls
      await io.input.text(new Error(), {
        this: BigInt(12),
        // @ts-expect-error: Ensuring we can handle invalid calls
        something: this.something,
      })
    },
    badMessage: async () => {
      const client = new IntervalClient(interval, interval.config)

      // @ts-expect-error: Intentionally using private method
      await client.initializeConnection()

      // @ts-expect-error: Intentionally using protected method
      await client.__dangerousInternalSend('NONEXISTANT', {
        gibberish: '1234',
        error: new Error(),
      })
    },
    url: async () => {
      const url = await io.input.url('Enter a URL', {
        helpText: 'This is help text',
        placeholder: 'https://google.com',
        allowedProtocols: ['https'],
      })

      return { url: url.href }
    },
    redirect: async () => {
      const [url, , action, paramsStr] = await io.group([
        io.input.url('Enter a URL').optional(),
        io.display.markdown('--- or ---'),
        io.input.text('Enter an action slug').optional(),
        io.input
          .text('With optional params', {
            multiline: true,
          })
          .optional(),
      ])

      let params = undefined
      if (url) {
        await ctx.redirect({ url: url.toString() })
      } else if (action) {
        if (paramsStr) {
          try {
            params = JSON.parse(paramsStr)
          } catch (err) {
            ctx.log('Invalid params object', paramsStr)
          }
        }

        await ctx.redirect({ action, params })
      } else {
        throw new Error('Must enter either a URL or an action slug')
      }

      console.log({
        url,
        action,
        params,
      })

      return {
        url: url?.toString(),
        action,
        paramsStr,
      }
    },
    continue_button: async () => {
      const url = await io.group([io.input.text('Important data')], {
        continueButton: {
          label: 'Delete the data',
          theme: 'danger',
        },
      })

      return 'All done!'
    },
    tables: new Router({
      name: 'Tables',
      routes: table_actions,
    }),
    confirm_identity: async () => {
      await io.input.text('Enter your name')

      const canDoSensitiveTask = await io.confirmIdentity(
        'This action is pretty sensitive',
        {
          gracePeriodMs: 0,
        }
      )
      let canDoSensitiveTaskAgain = false

      if (canDoSensitiveTask) {
        ctx.log('OK! Identity confirmed.')
        await io.input.text('Enter another name')
        canDoSensitiveTaskAgain = await io.confirmIdentity(
          'This action is still pretty sensitive'
        )
      } else {
        ctx.log('Identity not confirmed, cancelling…')
      }

      return {
        identityConfirmed: canDoSensitiveTask && canDoSensitiveTaskAgain,
      }
    },
  },
})

interval.listen()
