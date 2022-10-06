import Interval, { Router, ctx, io, Layout } from '../../experimental'
import { IntervalActionDefinitions } from '../../types'
import { sleep } from '../utils/helpers'
import * as db from './db'

const routes: IntervalActionDefinitions = {
  // root-level action
  hello_world: async () => {
    return 'Hello, world!'
  },
  // empty router
  emptyRouter: new Router({
    name: 'Empty router',
  }),
  // router with actions but no index page
  actionsOnly: new Router({
    name: 'Actions only',
    routes: {
      action_one: async () => {
        return 'Hello, world!'
      },
      action_two: async () => {
        return 'Hello, world!'
      },
    },
  }),
  // router with index page, no routes
  indexOnly: new Router({
    name: 'Index only',
    async index() {
      return new Layout.Basic({
        title: 'Index only',
        children: [io.display.markdown('Hello, world!')],
      })
    },
  }),
  // router with actions and a nested router with an index page
  users: new Router({
    name: 'Users',
    async index() {
      const allUsers = db.getUsers()

      return new Layout.Basic({
        title: 'Users',
        description:
          'This is a multi-level router with multiple nested routers',
        menuItems: [
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
    routes: {
      create: {
        name: 'Create user',
        handler: async () => {
          const [firstName, lastName, email] = await io.group(
            [
              io.input.text('First name'),
              io.input.text('Last name'),
              io.input.email('Email address'),
            ],
            {
              continueButton: {
                label: 'Create user',
              },
            }
          )

          await sleep(1000)

          return { firstName, lastName, email }
        },
      },
      subscriptions: new Router({
        name: 'Subscriptions',
        async index() {
          const data = db.getSubscriptions()

          return new Layout.Basic({
            title: 'Subscriptions',
            children: [
              io.display.table('Subscriptions', {
                data,
                rowMenuItems: row => [
                  {
                    label: 'Edit',
                    action: 'users/subscriptions/edit',
                    params: { id: row.id },
                  },
                  {
                    label: 'Cancel',
                    action: 'users/subscriptions/cancel',
                    theme: 'danger',
                    params: { id: row.id },
                  },
                ],
              }),
            ],
          })
        },
        routes: {
          edit: {
            name: 'Edit subscription',
            unlisted: true,
            handler: async () => {
              return 'Hello, world!'
            },
          },
          cancel: {
            name: 'Cancel subscription',
            unlisted: true,
            handler: async () => {
              return 'Hello, world!'
            },
          },
        },
      }),
      comments: new Router({
        name: 'Comments',
        async index() {
          const data = db.getComments()

          return new Layout.Basic({
            title: 'Comments',
            menuItems: [
              {
                label: 'Create comment',
                action: 'users/comments/create',
              },
            ],
            children: [
              io.display.table('Comments', {
                data,
                rowMenuItems: row => [
                  {
                    label: 'Edit',
                    action: 'users/comments/edit',
                    params: { id: row.id },
                  },
                ],
              }),
            ],
          })
        },
        routes: {
          create: {
            name: 'Create comment',
            handler: async () => {
              return '👋'
            },
          },
          edit: {
            name: 'Edit comment',
            unlisted: true,
            handler: async () => {
              return '👋'
            },
          },
          nested: new Router({
            name: 'Nested L1',
            async index() {
              return new Layout.Basic({})
            },
            routes: {
              create: {
                name: 'Create L1',
                handler: async () => {
                  return '👋'
                },
              },
              nested_2: new Router({
                name: 'Nested L2',
                async index() {
                  return new Layout.Basic({})
                },
                routes: {
                  create: {
                    name: 'Create L2',
                    handler: async () => {
                      return '👋'
                    },
                  },
                },
              }),
            },
          }),
        },
      }),
    },
  }),
}

const interval = new Interval({
  apiKey: 'alex_dev_Bku6kYZlyhyvkCO36W5HnpwtXACI1khse8SnZ9PuwsmqdRfe',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes,
})

interval.listen()

const prod = new Interval({
  apiKey: 'live_arKSsqtp1R6Mf6w16jflF4ZDDtFC7LwBaKLDDne3MZUgGyev',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes,
})

prod.listen()
