import component from '../component'
import type { T_IO_PROPS } from '../ioSchema'
import type { IOPromiseConstructor } from '../io'

export default function findAndSelectUser(
  constructor: IOPromiseConstructor<'SELECT_USER'>
) {
  return (
    label: string,
    props: T_IO_PROPS<'SELECT_USER'> & {
      onSearch: (
        query: string
      ) => Promise<T_IO_PROPS<'SELECT_USER'>['userList']>
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
