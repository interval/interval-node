import { faker } from '@faker-js/faker'

faker.seed(0)

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  createdAt: Date
}

const allUsers: User[] = Array.from({ length: 313 }, () => {
  return {
    id: faker.datatype.uuid(),
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    email: faker.internet.email(),
    createdAt: faker.date.recent(30),
  }
}).sort((a, b) => {
  return b.createdAt.getTime() - a.createdAt.getTime()
})

export function getUsers() {
  return allUsers
}

export function getUser(id: string) {
  return allUsers.find(user => user.id === id) ?? null
}

/**
 * Comments
 */
export interface Comment {
  id: string
  userId: string
  createdAt: Date
  message: string
}

const allComments: Comment[] = Array.from({ length: 313 }, () => {
  return {
    id: faker.datatype.uuid(),
    createdAt: faker.date.recent(30),
    userId: faker.helpers.arrayElement(allUsers).id,
    message: faker.hacker.phrase(),
  }
}).sort((a, b) => {
  return b.createdAt.getTime() - a.createdAt.getTime()
})

export function getComments() {
  return allComments
}

export function getComment(id: string) {
  return allComments.find(c => c.id === id) ?? null
}

/**
 * Subscriptions
 */
export interface Subscription {
  id: string
  userId: string
  createdAt: Date
  plan: string
  status: 'active' | 'canceled' | 'past_due'
}

const allSubscriptions: Subscription[] = Array.from({ length: 313 }, () => {
  return {
    id: faker.datatype.uuid(),
    createdAt: faker.date.recent(30),
    userId: faker.helpers.arrayElement(allUsers).id,
    plan: faker.helpers.arrayElement(['Basic', 'Premium', 'Enterprise']),
    status: faker.helpers.arrayElement(['active', 'canceled', 'past_due']),
  }
})

export function getSubscriptions() {
  return allSubscriptions
}

export function getSubscription(id: string) {
  return allSubscriptions.find(s => s.id === id) ?? null
}
