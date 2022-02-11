import component from '../component'
import type { T_IO_METHOD } from '../ioSchema'
import type { IOPromiseConstructor } from '../io'

export default function findAndSelectUser(
  constructor: IOPromiseConstructor<'SELECT_USER'>
) {
  return (
    label: string,
    props: T_IO_METHOD<'SELECT_USER', 'props'> & {
      onSearch: (
        query: string
      ) => Promise<T_IO_METHOD<'SELECT_USER', 'returns'>[]>
    }
  ) => {
    const c = component(
      'SELECT_USER',
      label,
      { userList: props.userList },
      async newState => {
        const filteredUsers = await props.onSearch(newState.queryTerm)
        return { userList: filteredUsers }
      }
    )

    return constructor(c)
  }
}
