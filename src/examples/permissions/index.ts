import Interval, { Action, Page } from '../../experimental'
import { IntervalRouteDefinitions } from '../../types'

const routes: IntervalRouteDefinitions = {
  permissions: new Page({
    name: 'Permissions',
    routes: {
      support: {
        name: 'Support action',
        description: 'This action can only be run by the Support team.',
        handler: async () => {
          return 'Hello, world!'
        },
        accessControl: {
          teams: ['Support'],
        },
      },
      organization: {
        name: 'Organization action',
        description: 'This action can be run by anyone in the organization.',
        handler: async () => {
          return 'Hello, world!'
        },
        accessControl: 'organization',
      },
      no_access: {
        name: 'No-access action',
        description: "This action can't be run by anyone in the organization.",
        handler: async () => {
          return 'Hello, world!'
        },
        accessControl: {
          teams: [],
        },
      },
    },
  }),
  groupPermissions: new Page({
    name: 'Group permissions',
    description: "This group's permissions apply to all routes within it",
    accessControl: {
      teams: ['Engineers'],
    },
    routes: {
      support: {
        name: 'Restricted engineers action',
        description: 'This action can only be run by the Engineers team.',
        handler: async () => {
          return 'Hello, world!'
        },
      },
    },
  }),
}

const interval = new Interval({
  apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes,
})

interval.listen()

const prod = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  routes,
})

prod.listen()
