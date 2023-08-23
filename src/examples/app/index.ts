import Interval, { Page, ctx, io, Layout } from '../..'
import { sleep } from '../utils/helpers'
import * as db from './db'
import env from '../../env'

const hello_app = new Page({
  name: 'App',
  description: 'This should have a description',
  handler: async () => {
    return new Layout({
      title: sleep(1000).then(() => 'Resource'),
      description: sleep(750).then(
        () => 'This is an asynchronous description!'
      ),
      menuItems: [
        {
          label: 'External link',
          url: 'https://google.com',
        },
        {
          label: 'Action link',
          route: 'hello_app/hello_world',
        },
        // {
        //   label: 'Inline action',
        //   action: async () => {
        //     const name = await io.input.text('Your name')
        //     await io.display.markdown(`Hello, ${name}`)
        //     return {
        //       name,
        //     }
        //   },
        // },
      ],
      children: [
        io.display.markdown('Hello, resource!'),
        io.display.table('A table', {
          data: [
            { a: 1, b: 2, c: 3 },
            { a: 1, b: 2, c: 3 },
            { a: 1, b: 2, c: 3 },
          ],
          rowMenuItems: () => [
            {
              label: 'Hello',
              route: 'hello_app/hello_world',
            },
          ],
        }),
        io.display.heading('Section two', {
          level: 3,
          description: 'This table has the same data as the previous one.',
          menuItems: [
            {
              label: 'Action link',
              action: 'hello_app/hello_world',
            },
          ],
        }),
        io.display.table('', {
          data: [
            { a: 1, b: 2, c: 3 },
            { a: 1, b: 2, c: 3 },
            { a: 1, b: 2, c: 3 },
          ],
          rowMenuItems: () => [
            {
              label: 'Hello',
              action: 'hello_app/hello_world',
            },
          ],
        }),
      ],
    })
  },
  routes: {
    hello_world: async () => {
      return 'Hello, world!'
    },
  },
})

const users = new Page({
  name: 'Users',
  handler: async () => {
    if (ctx.params.userId && typeof ctx.params.userId === 'string') {
      const user = db.getUser(ctx.params.userId)
      if (!user) throw new Error('User not found')

      return new Layout({
        menuItems: [
          {
            label: 'Edit user',
            route: 'users/edit',
            params: {
              userId: user.id,
            },
          },
        ],
        children: [
          io.display.metadata(`${user.firstName} ${user.lastName}`, {
            data: [
              {
                label: 'ID',
                value: user.id,
              },
              {
                label: 'Email',
                value: user.email,
                url: `mailto:${user.email}`,
              },
              {
                label: 'Created at',
                value: user.createdAt,
              },
            ],
          }),
        ],
      })
    } else {
      const allUsers = db.getUsers()
      return new Layout({
        menuItems: [
          {
            label: 'View funnel',
            route: 'users/view_funnel',
          },
          {
            label: 'Create user',
            route: 'users/create',
          },
        ],
        children: [
          io.display.table('Users', {
            data: allUsers,
            rowMenuItems: row => [
              {
                label: 'Edit',
                route: 'users/edit',
                params: { userId: row.id },
              },
            ],
            columns: [
              {
                label: 'ID',
                accessorKey: 'id',

                renderCell: user => ({
                  label: user.id,
                  route: 'users',
                  params: {
                    userId: user.id,
                  },
                }),
              },
              {
                label: 'First name',
                accessorKey: 'firstName',
              },
              {
                label: 'Last name',
                accessorKey: 'lastName',
              },
              {
                label: 'Email',
                accessorKey: 'email',
                renderCell: user => ({
                  label: user.email,
                  url: `mailto:${user.email}`,
                }),
              },
              {
                label: 'Created at',
                accessorKey: 'createdAt',
              },
            ],
          }),
        ],
      })
    }
  },
  routes: {
    create: {
      name: 'Create user',
      handler: async () => {
        const [firstName, lastName, email] = await io.group([
          io.input.text('First name'),
          io.input.text('Last name'),
          io.input.email('Email'),
        ])

        await sleep(1000)

        return { firstName, lastName, email }
      },
    },
    edit: {
      name: 'Edit user',
      unlisted: true,
      handler: async () => {
        const userId = ctx.params.userId
        if (!userId) throw new Error('No user ID provided')

        const user = db.getUser(String(userId))
        if (!user) throw new Error('User not found')

        const [firstName, lastName, email] = await io.group([
          io.input.text('ID', { defaultValue: user.id, disabled: true }),
          io.input.text('First name', { defaultValue: user.firstName }),
          io.input.text('Last name', { defaultValue: user.lastName }),
          io.input.email('Email', { defaultValue: user.email }),
        ])

        await sleep(1000)

        return { firstName, lastName, email }
      },
    },
    view_funnel: {
      name: 'View funnel',
      handler: async () => {
        await io.display.markdown('# 🌪️')
      },
    },
  },
})

const interval = new Interval({
  logLevel: 'debug',
  apiKey: 'alex_dev_Bku6kYZlyhyvkCO36W5HnpwtXACI1khse8SnZ9PuwsmqdRfe',
  endpoint: 'ws://localhost:3000/websocket',
  routes: {
    hello_app,
    users,
    info: new Page({
      name: 'Info',
      async handler() {
        return new Layout({
          title: 'Info',
          description: 'This is a text-only page. No children, just text.',
          menuItems: [
            {
              label: 'Reload',
              route: 'info',
            },
            {
              label: 'Add timestamp param',
              route: 'info',
              params: { timestamp: new Date().valueOf() },
            },
          ],
        })
      },
    }),
    hello_world: {
      name: 'Hello world',
      description: 'This should have a description too',
      handler: async () => {
        await io.display.markdown('Hello, world!')
      },
    },
    unlisted_router: new Page({
      name: 'Unlisted',
      unlisted: true,
      actions: {
        unlisted_listed: {
          name: 'Listed',
          handler: async () => {
            await io.display.markdown('Hello, world!')
          },
        },
      },
    }),
    unlisted_action: {
      name: 'Unlisted',
      unlisted: true,
      handler: async () => {
        await io.display.markdown("You're in")
      },
    },
  },
})

interval.listen()

const prod = new Interval({
  apiKey: env.DEMO_PROD_API_KEY,
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes: {
    hello_app,
    hello_world: {
      name: 'Hello world',
      handler: async () => {
        // await io.display.markdown('Hello, world!')
        return 'Hello, world!'
      },
    },
    unlisted: {
      name: 'Unlisted',
      unlisted: true,
      handler: async () => {
        return 'Hello, invisibly!'
      },
    },
  },
})

prod.listen()
