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
      const engineers = await io.input(
        io.select.fromTabularData({ label: 'Select users:', data: users })
      )

      const selectedNames = engineers.map(eng => eng.name).join(', ')

      io.input(
        io.display.heading({
          label: `You selected: ${selectedNames}.`,
        })
      )
    },
    'For loop demo': async io => {
      console.log("Let's say hello...")

      await io.display.progressThroughList(
        ['Alex', 'Dan', 'Kyle', 'Ryan', 'Jacob'],
        async item => {
          const time = 1000 * item.length
          await sleep(time)
          return `Completed in ${time}ms`
        }
      )
    },
    'Single select demo': async io => {
      await io.input(
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
        })
      )
    },
    'Create a user account': async io => {
      const [first, last] = await io.inputGroup([
        io.ask.forText({ label: 'First' }),
        io.ask.forText({ label: 'Last' }),
        io.ask.forCheckbox({
          label: 'Subscribe to mailing list',
          defaultValue: true,
        }),
      ])

      io.input(
        io.display.heading({
          label: `You created a user with name ${first} ${last}.`,
        })
      )
    },
  },
})
