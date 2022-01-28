import { IntervalActionHandler } from '..'
import { fakeDb } from './helpers'

const editEmailForUser: IntervalActionHandler = async io => {
  console.log("Let's say hello...")

  const initialUsers = await fakeDb.find('')

  const resp = await io.renderGroup([
    io.display.heading({
      label: 'Edit email address for user',
    }),
    io.experimental.findAndSelectUser({
      label: 'Select a user',
      userList: initialUsers,
      onSearch: async query => {
        const resp = await fakeDb.find(query)
        return resp
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
}

export default editEmailForUser
