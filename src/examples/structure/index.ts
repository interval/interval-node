import Interval, { Router, ctx, io, Layout } from '../../experimental'
import { IntervalActionDefinitions } from '../../types'

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
  multiLevel: new Router({
    name: 'Multi-level router',
    routes: {
      hello_world: async () => {
        return 'Hello, world!'
      },
      nested: new Router({
        name: 'Nested router',
        async index() {
          return new Layout.Basic({
            title: 'Nested router',
          })
        },
        routes: {
          hello_app: async () => {
            return 'Hello, app!'
          },
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
