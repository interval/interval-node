import { faker } from '@faker-js/faker'
import { IntervalActionHandler } from '../..'
import ExperimentalInterval, { Page, io, ctx, Layout } from '../../experimental'

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

const usersGroup = new Page({
  name: 'Users',
  handler: async () => {
    return new Layout.Basic({
      title: 'Users',
    })
  },
  routes: {
    index: action,
    create: {
      name: 'Create user',
      handler: editAction,
    },
    edit: {
      name: 'Edit user',
      handler: editAction,
    },
    billing: new Page({
      name: 'Billing',
      handler: async () => {
        return new Layout.Basic({
          title: 'Billing',
        })
      },
      routes: {
        view_unpaid_invoices: action,
      },
    }),
  },
})

const classesGroup = new Page({
  name: 'Classes',
  routes: {
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
  routes: {
    hello_world: action,
  },
})

prod.routes.add('classes', classesGroup)
prod.routes.add('users', usersGroup)
prod.listen()

/**
 * Dev mode
 */
const dev = new ExperimentalInterval({
  apiKey: 'alex_dev_Bku6kYZlyhyvkCO36W5HnpwtXACI1khse8SnZ9PuwsmqdRfe',
  endpoint: 'ws://localhost:3000/websocket',
  routes: {
    hello_world: action,
  },
})

dev.routes.add('classes', classesGroup)
dev.routes.add('users', usersGroup)
dev.listen()
