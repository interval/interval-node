import createIntervalHost from '../index'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const users = [
  {
    id: '1',
    name: 'Alex Arena',
    email: 'alex@interval.com',
  },
  {
    id: '2',
    name: 'Dan Philibin',
    email: 'dan@interval.com',
  },
  {
    id: '3',
    name: 'Jacob Mischka',
    email: 'jacob@interval.com',
  },
  {
    id: '4',
    name: 'Ryan Coppolo',
    email: 'ryan@interval.com',
  },
  {
    id: '5',
    name: 'Kyle Sanok',
    email: 'kyle@interval.com',
  },
]

createIntervalHost({
  endpoint: 'ws://localhost:3001',
  apiKey: '24367604-b35f-4b89-81bc-7d1cf549ba60',
  logLevel: 'debug',
  actions: {
    'Tabular data demo': async io => {
      await io.render(
        io.select.user({
          label: 'Find a user',
          data: users.map(name => ({ ...name, imageUrl: '' })),
        })
      )

      const selected = await io.render(
        io.select.table({ label: 'Select users:', data: users })
      )

      const amount = await io.render(
        io.input.number({ label: 'Credit amount to apply:', prepend: '$' })
      )

      const names = selected.map(eng => String(eng.name))

      await io.display.progressThroughList({
        label: 'Applying credit...',
        items: names,
        itemHandler: async item => {
          await sleep(2000)
          return `Applied $${amount} credit`
        },
      })
    },
    'For loop demo': async io => {
      await io.display.progressThroughList({
        label: 'Loading users',
        items: ['Alex', 'Dan', 'Kyle', 'Ryan', 'Jacob'],
        itemHandler: async item => {
          const time = 1000 * item.length
          await sleep(time)
          return `Completed in ${time}ms`
        },
      })
    },
    'Create a user account': async io => {
      const [first, last, email, role, isSubscribed] = await io.renderGroup([
        io.input.text({ label: 'First name' }),
        io.input.text({ label: 'Last name' }),
        io.input.email({ label: 'Email address' }),
        io.select.single({
          label: 'Role',
          options: [
            {
              label: 'Admin',
              value: 'admin',
            },
            {
              label: 'Editor',
              value: 'editor',
            },
            {
              label: 'Viewer',
              value: 'viewer',
            },
          ],
        }),
        io.input.boolean({
          label: 'Subscribe to mailing list',
          defaultValue: true,
        }),
      ])

      io.render(
        io.display.heading({
          label: `User created: ${first} ${last} (${email}).`,
        })
      )
    },
  },
})
