import Interval, { ActionGroup, ctx, io } from '../../experimental'
import { Resource } from '../../classes/Page'
import { sleep } from '../utils/helpers'
import * as db from './db'

const hello_app = new ActionGroup({
  name: 'App',
  render: async () => {
    return new Resource({
      title: sleep(1000).then(() => 'Resource'),
      description: sleep(750).then(
        () => 'This is an asynchronous description!'
      ),
      metadata: [
        { label: 'Static', value: 3 },
        { label: 'Function', value: () => 'result' },
        {
          label: 'Async function',
          value: async () => {
            await sleep(1000)
            return '1 second'
          },
        },
        { label: 'Promise', value: sleep(2000).then(() => 2000) },
      ],
      menuItems: [
        {
          label: 'Action link',
          action: 'hello_app/hello_world',
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
              action: 'hello_app/hello_world',
            },
            // {
            //   label: 'Inline',
            //   action: async () => {},
            // },
          ],
        }),
      ],
    })
  },
  actions: {
    hello_world: async () => {
      return 'Hello, world!'
    },
  },
})

const users = new ActionGroup({
  name: 'Users',
  render: async () => {
    const allUsers = db.getUsers()

    return new Resource({
      // TODO: this should fallback to the group title if undefined, I think
      title: 'Users',
      metadata: [
        { label: 'Total users', value: allUsers.length },
        {
          label: 'New today',
          value: allUsers.filter(
            u => u.createdAt.getTime() > Date.now() - 1000 * (60 * 60 * 24)
          ).length,
        },
        {
          label: 'New this week',
          value: allUsers.filter(
            u => u.createdAt.getTime() > Date.now() - 1000 * (60 * 60 * 24 * 7)
          ).length,
        },
      ],
      menuItems: [
        {
          label: 'View funnel',
          action: 'users/view_funnel',
        },
        {
          label: 'Create user',
          action: 'users/create',
        },
      ],
      children: [
        io.display.table('Users', {
          data: allUsers,
          rowMenuItems: row => [
            {
              label: 'Edit',
              action: 'users/edit',
              params: { id: row.id },
            },
          ],
        }),
      ],
    })
  },
  actions: {
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
        const userId = ctx.params.id
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
  apiKey: 'alex_dev_Bku6kYZlyhyvkCO36W5HnpwtXACI1khse8SnZ9PuwsmqdRfe',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    hello_app,
    users,
    info: new ActionGroup({
      name: 'Info',
      async render() {
        return new Resource({
          title: 'Info',
          description:
            'This is a text-only page. No children, just text. Metadata are params.',
          metadata: Object.entries(ctx.params).map(([label, value]) => ({
            label,
            value,
          })),
          menuItems: [
            {
              label: 'Add timestamp param',
              action: 'info',
              params: { timestamp: new Date().valueOf() },
            },
          ],
        })
      },
    }),
    hello_world: {
      name: 'Hello world',
      handler: async () => {
        await io.display.markdown('Hello, world!')
      },
    },
    unlisted: {
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
  apiKey: 'live_arKSsqtp1R6Mf6w16jflF4ZDDtFC7LwBaKLDDne3MZUgGyev',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    hello_app,
    hello_world: {
      name: 'Hello world',
      handler: async () => {
        // await io.display.markdown('Hello, world!')
        return 'Hello, world!'
      },
    },
  },
})

prod.listen()
