import Interval, { ActionGroup, io, ctx } from '../../experimental'
import { Resource } from '../../classes/Page'
import { sleep } from '../utils/helpers'

const hello_app = new ActionGroup({
  name: 'App',
  render: async () => {
    return new Resource({
      title: 'Resource',
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
          label: 'Inline action',
          action: async () => {
            const name = await io.input.text('Your name')
            await io.display.markdown(`Hello, ${name}`)
            return {
              name,
            }
          },
        },
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
              label: 'Edit',
              action: 'hello_app/hello_world',
            },
            {
              label: 'Inline',
              action: async () => {},
            },
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

const interval = new Interval({
  apiKey: 'alex_dev_Bku6kYZlyhyvkCO36W5HnpwtXACI1khse8SnZ9PuwsmqdRfe',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    hello_app,
  },
})

interval.listen()

const prod = new Interval({
  apiKey: 'live_arKSsqtp1R6Mf6w16jflF4ZDDtFC7LwBaKLDDne3MZUgGyev',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  actions: {
    hello_app,
  },
})

prod.listen()
