import { IntervalActionHandler } from '../..'
import { fakeDb, getImageUrl } from '../utils/helpers'

const editEmailForUser: IntervalActionHandler = async io => {
  console.log("Let's say hello...")

  type User = Awaited<ReturnType<typeof fakeDb['find']>>[0]

  const resp = await io.group([
    io.display.heading('Edit email address for user'),
    io.search<User>('Find a user', {
      placeholder: 'Search by name...',
      onSearch: async query => {
        return fakeDb.find(query)
      },
      renderResult: user => ({
        label: `${user.first_name} ${user.last_name}`,
        description: user.email,
        imageUrl: getImageUrl(user),
      }),
    }),
    io.select.single('Choose role', {
      options: [
        { label: 'Admin', value: 'a' },
        { label: 'Editor', value: 'b' },
        { label: 'Viewer', value: 'c' },
      ],
    }),
    io.input.text('Enter their new name'),
    io.input.email('Enter their new email'),
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

  await io.display.object('Response', { data: resp })

  console.log('Resp', resp)
}

export default editEmailForUser
