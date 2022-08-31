import { faker } from '@faker-js/faker'
import { IntervalActionHandler } from '../..'
import ExperimentalInterval, { ActionGroup, io, ctx } from '../../experimental'

const action: IntervalActionHandler = async () => {
  const message = await io.input.text('Hello?')

  return message
}

const editAction: IntervalActionHandler = async () => {
  const [firstName, lastName, email] = await io.group([
    io.input.text('First name', {
      defaultValue: ctx.params.id ? faker.name.firstName() : '',
    }),
    io.input.text('Last name', {
      defaultValue: ctx.params.id ? faker.name.lastName() : '',
    }),
    io.input.email('Email address', {
      defaultValue: ctx.params.id ? faker.internet.email() : '',
    }),
  ])

  return { firstName, lastName, email }
}

const usersGroup = new ActionGroup({
  name: 'Users',
  actions: {
    index: action,
    create: {
      name: 'Create user',
      handler: editAction,
    },
    edit: {
      name: 'Edit user',
      handler: editAction,
    },
  },
  groups: {
    billing: new ActionGroup({
      name: 'Billing',
      actions: {
        view_unpaid_invoices: action,
      },
    }),
  },
})

const classesGroup = new ActionGroup({
  name: 'Classes',
  actions: {
    index: action,
    create: {
      name: 'Create class',
      handler: action,
    },
    edit: {
      name: 'Edit class',
      handler: action,
    },
  },
})

/**
 * Live mode
 */
const prod = new ExperimentalInterval({
  apiKey: 'live_arKSsqtp1R6Mf6w16jflF4ZDDtFC7LwBaKLDDne3MZUgGyev',
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    hello_world: action,
  },
})

prod.addGroup('classes', classesGroup)
prod.addGroup('users', usersGroup)
prod.listen()

/**
 * Dev mode
 */
const dev = new ExperimentalInterval({
  apiKey: 'jovany_dev_JpBOS3mk6ZbNcEP5zNyVLEIM25K3oZgU8qEyGcJgbVtgaJtm',
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    hello_world: action,
  },
})

dev.addGroup('classes', classesGroup)
dev.addGroup('users', usersGroup)
dev.listen()
