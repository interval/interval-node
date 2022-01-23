import component from '../component'
import { T_IO_METHOD } from '../ioSchema'

export default function findAndSelectUser(
  props: T_IO_METHOD<'ASK_FOR_USER', 'props'> & {
    onSearch: (
      query: string
    ) => Promise<T_IO_METHOD<'ASK_FOR_USER', 'returns'>[]>
  }
) {
  return component(
    'ASK_FOR_USER',
    { label: props.label, userList: props.userList },
    async newState => {
      const filteredUsers = await props.onSearch(newState.queryTerm)
      return { label: props.label, userList: filteredUsers }
    }
  )
}
