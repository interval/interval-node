import type { T_IO_PROPS, T_IO_STATE } from '../ioSchema'

export default function findAndSelectUser(
  props: T_IO_PROPS<'SELECT_USER'> & {
    onSearch: (query: string) => Promise<T_IO_PROPS<'SELECT_USER'>['userList']>
  }
) {
  return {
    async onStateChange(newState: T_IO_STATE<'SELECT_USER'>) {
      const filteredUsers = await props.onSearch(newState.queryTerm)
      return { userList: filteredUsers }
    },
  }
}
