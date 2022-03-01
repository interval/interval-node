import Interval from '../index'
import { DEMO_API_KEY } from '../../env'

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

const interval = new Interval({
  apiKey: DEMO_API_KEY,
  logLevel: 'debug',
  actions: {
    apply_account_credit: async io => {
      const selected = await io.select.table('Select users:', {
        data: users,
      })

      const amount = await io.input.number('Credit amount to apply:', {
        prepend: '$',
      })

      const names = selected.map(eng => String(eng.name))

      await io.experimental.progressThroughList(
        'Applying credit...',
        names,
        async () => {
          await sleep(2000)
          return `Applied $${amount} credit`
        }
      )
    },
    update_users: async io => {
      await io.experimental.progressThroughList(
        'Loading users',
        ['Alex', 'Dan', 'Kyle', 'Ryan', 'Jacob'],
        async item => {
          const time = 1000 * item.length
          await sleep(time)
          return `Completed in ${time}ms`
        }
      )
    },
    create_user: async io => {
      let [first, last, email, role, isSubscribed] = await io.group([
        io.input.text('First name'),
        io.input.text('Last name'),
        io.input.email('Email address'),
        io.select.single('Role', {
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
        io.input.boolean('Subscribe to mailing list', {
          defaultValue: true,
        }),
      ])

      if (role.value === 'admin') {
        const isConfirmed = await io.input.boolean(
          `Are you sure you want to make ${first} ${last} an admin?`,
          {
            defaultValue: false,
          }
        )
        if (!isConfirmed) {
          role = {
            label: 'Viewer',
            value: 'viewer',
          }
        }
      }

      io.display.heading(
        `User created: ${first} ${last} (${email}) with role ${role.label}`
      )
    },
  },
})

interval.listen()
