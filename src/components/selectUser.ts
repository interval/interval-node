import component from '../component'
import type { T_IO_METHOD } from '../ioSchema'
import type { IOPromiseConstructor } from '../io'

export default function findAndSelectUser(
  constructor: IOPromiseConstructor<'SELECT_USER'>
) {
  return (
    props: T_IO_METHOD<'SELECT_USER', 'props'> & {
      onSearch: (
        query: string
      ) => Promise<T_IO_METHOD<'SELECT_USER', 'returns'>[]>
    }
  ) => {
    const c = component(
      'SELECT_USER',
      { label: props.label, userList: props.userList },
      async newState => {
        const filteredUsers = await props.onSearch(newState.queryTerm)
        return { label: props.label, userList: filteredUsers }
      }
    )

    return constructor(c)
  }
}
