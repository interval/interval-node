import component from '../component'
import { T_IO_METHOD } from '../ioSchema'

export default function findAndSelectUser(
  props: T_IO_METHOD<'SELECT_USER', 'props'> & {
    onSearch: (
      query: string
    ) => Promise<T_IO_METHOD<'SELECT_USER', 'returns'>[]>
  }
) {
  return component(
    'SELECT_USER',
    { label: props.label, userList: props.userList },
    async newState => {
      const filteredUsers = await props.onSearch(newState.queryTerm)
      return { label: props.label, userList: filteredUsers }
    }
  )
}
