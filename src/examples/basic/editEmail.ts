import { IntervalActionHandler } from '../..'
import { fakeDb, mapToSelectOption } from '../utils/helpers'

const editEmailForUser: IntervalActionHandler = async io => {
  console.log("Let's say hello...")

  const initialUsers = await fakeDb.find('')

  const resp = await io.group([
    io.display.heading('Edit email address for user'),
    io.experimental.findAndSelect('Select a user', {
      initialOptions: initialUsers.map(mapToSelectOption),
      onSearch: async query => {
        const resp = await fakeDb.find(query)
        return resp.map(mapToSelectOption)
      },
    }),
    io.select.single('Choose role', {
      options: [
        { label: 'Admin', value: 'a' },
        { label: 'Editor', value: 'b' },
        { label: 'Viewer', value: 'c' },
      ],
    }),
    io.input.text('Enter their new name'),
    io.input.email('Enter their new email', { placeholder: 'you@example.com' }),
    io.input.number('Enter an amount', {
      prepend: '$',
      decimals: 2,
    }),
    io.input.boolean('Are you sure?'),
    io.select.single('Select an opt', {
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    }),
    io.select.multiple('Select some opts', {
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    }),
    io.select.table('Select from this table', {
      data: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b', otherExtraData: 'ok' },
        { label: 'C', value: 'c', extraData: true },
      ],
    }),
  ])

  const found = resp[1]

  console.log(found)

  io.group([
    io.display.heading('You successfully edited email for ' + found.label),
  ])

  console.log('Resp', resp)
}

export default editEmailForUser
