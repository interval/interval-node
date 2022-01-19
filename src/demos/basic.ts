import createIntervalHost from '../index'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const users = [
  {
    id: 1,
    name: 'Alex Arena',
    email: 'alex@interval.com',
  },
  {
    id: 2,
    name: 'Dan Philibin',
    email: 'dan@interval.com',
  },
  {
    id: 3,
    name: 'Jacob Mischka',
    email: 'jacob@interval.com',
  },
  {
    id: 4,
    name: 'Ryan Coppolo',
    email: 'ryan@interval.com',
  },
  {
    id: 5,
    name: 'Kyle Sanok',
    email: 'kyle@interval.com',
  },
]

createIntervalHost({
  apiKey: '24367604-b35f-4b89-81bc-7d1cf549ba60',
  actions: {
    'Tabular data demo': async io => {
      const selected = await io.input(
        io.select.fromTabularData({ label: 'Select users:', data: users })
      )

      const amount = await io.input(
        io.ask.forNumber({ label: 'Credit amount to apply:', prepend: '$' })
      )

      const names = selected.map(eng => String(eng.name))

      await io.display.progressThroughList(names, async item => {
        await sleep(2000)
        return `Applied $${amount} credit`
      })
    },
    'For loop demo': async io => {
      await io.display.progressThroughList(
        ['Alex', 'Dan', 'Kyle', 'Ryan', 'Jacob'],
        async item => {
          const time = 1000 * item.length
          await sleep(time)
          return `Completed in ${time}ms`
        }
      )
    },
    'Create a user account': async io => {
      const [first, last, email] = await io.inputGroup([
        io.ask.forText({ label: 'First name' }),
        io.ask.forText({ label: 'Last name' }),
        io.ask.forText({ label: 'Email address', type: 'email' }),
        io.ask.forSingle({
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
        io.ask.forCheckbox({
          label: 'Subscribe to mailing list',
          defaultValue: true,
        }),
      ])

      io.input(
        io.display.heading({
          label: `User created: ${first} ${last} (${email}).`,
        })
      )
    },
  },
})
