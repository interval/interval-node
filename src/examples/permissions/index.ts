import { IntervalActionDefinition } from '@interval/sdk/src/types'
import Interval, { Action, Page } from '../../experimental'
import { IntervalRouteDefinitions } from '../../types'

const actions: Record<string, IntervalActionDefinition> = {
  engineers: {
    name: 'Engineers action',
    description: 'This action can only be run by the Engineers team.',
    handler: async () => {
      return 'Hello, world!'
    },
    accessControl: {
      teams: ['Engineers'],
    },
  },
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
    // this is the default setting, just showing it here for clarity
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
  inherited: {
    name: 'Inherited access action',
    description: 'This action inherits access from its parent group.',
    handler: async () => {
      return 'Hello, world!'
    },
  },
}

const routes: IntervalRouteDefinitions = {
  ...actions,
  engineersGroup: new Page({
    name: 'Engineers group',
    description: 'Can only be seen and accessed by the Engineers group',
    accessControl: {
      teams: ['Engineers'],
    },
    routes: {
      action: actions['inherited'],
    },
  }),
  supportGroup: new Page({
    name: 'Support actions',
    description: 'Can only be seen and accessed by the Support group',
    accessControl: {
      teams: ['Support'],
    },
    routes: {
      action: actions['inherited'],
    },
  }),
  nestedAccess: new Page({
    name: 'Nested access',
    description:
      'Does not have access to this group, but has access to an action within the group',
    accessControl: {
      teams: ['Support'],
    },
    routes: {
      engAction: {
        name: 'You can run this',
        description: 'This action can only be run by the Engineers team.',
        accessControl: {
          teams: ['Engineers'],
        },
        handler: async () => {
          return 'Hello, world!'
        },
      },
      supportAction: {
        name: "You can't run this",
        description: 'Inherits access from the group',
        handler: async () => {
          return 'Hello, world!'
        },
      },
    },
  }),
  deeplyNested: new Page({
    name: 'Deeply nested access',
    description:
      'Does not have access to this group, but has access to an action within the group',
    accessControl: {
      teams: ['Support'],
    },
    routes: {
      level2: new Page({
        name: 'Level 2',
        routes: {
          engAction: actions['engineers'],
        },
      }),
      action: actions['inherited'],
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
