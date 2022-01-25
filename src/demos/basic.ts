import createIntervalHost from '../index'
import fakeUsers from './fakeUsers'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const fakeDb = (function fakeDb() {
  const data = fakeUsers

  return {
    async find(input: string) {
      await sleep(500)
      const inputLower = input.toLowerCase()
      return data
        .filter(v => {
          const searchStr = (v.email + v.first_name + v.last_name).toLowerCase()
          return searchStr.includes(inputLower)
        })
        .slice(0, 10)
    },
  }
})()

createIntervalHost({
  apiKey: '24367604-b35f-4b89-81bc-7d1cf549ba60',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3001',
  actions: {
    'Progress through long list': async io => {
      const [resp] = await io.renderGroup([
        io.display.progressThroughList(
          ['Dan', 'Alex', 'Jacob'],
          async person => {
            await sleep(1000)
            return `Hi, ${person}!`
          },
          { label: 'Here are some items' }
        ),
      ])
      console.log('done!', resp)
    },
    'No interactive elements': async io => {
      io.renderGroup([io.display.heading({ label: 'I do nothing :(' })])
      console.log('done!')
    },
    'Unique ID tester': async io => {
      const name = await io.renderGroup([io.input.text({ label: 'Your name' })])
      const name2 = await io.renderGroup([
        io.input.text({ label: 'Your name' }),
      ])

      console.log(name, name2)
    },
    'Hello current user': async (io, ctx) => {
      io.renderGroup([
        io.display.heading({
          label: `Hello, ${ctx.user.firstName} ${ctx.user.lastName}`,
        }),
      ])
    },
    'Update email for user': async io => {
      console.log("Let's say hello...")

      const initialUsers = await fakeDb.find('')

      function toIntervalUser(inputUser: {
        first_name: string
        last_name: string
        email: string
        username: string
      }) {
        const name = `${inputUser.first_name} ${inputUser.last_name}`
        return {
          id: inputUser.username,
          name: name,
          email: inputUser.email,
          imageUrl: `https://avatars.dicebear.com/api/pixel-art/${encodeURIComponent(
            name
          )}.svg?scale=96&translateY=10`,
        }
      }

      const resp = await io.renderGroup([
        io.display.heading({
          label: 'Edit email address for user',
        }),
        io.findAndSelectUser({
          label: 'Select a user',
          userList: initialUsers.map(toIntervalUser),
          onSearch: async query => {
            const resp = await fakeDb.find(query)
            return resp.map(toIntervalUser)
          },
        }),
        io.input.text({ label: 'Enter their new name' }),
        io.input.email({ label: 'Enter their new email' }),
        io.input.number({ label: 'Enter an amount' }),
        io.input.boolean({ label: 'Are you sure?' }),
        io.select.single({
          label: 'Select an opt',
          options: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        }),
        io.select.multiple({
          label: 'Select some opts',
          options: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        }),
        io.select.table({
          label: 'Select from this table',
          data: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        }),
      ])
      io.renderGroup([
        io.display.heading({
          label: 'You successfully edited email for ' + resp[1].name,
        }),
      ])

      console.log('Resp', resp)
    },
  },
})
