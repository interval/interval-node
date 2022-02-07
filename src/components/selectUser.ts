import component from '../component'
import type { T_IO_METHOD } from '../ioSchema'
import type { IOPromiseConstructor } from '../io'

export default function findAndSelectUser(
  constructor: IOPromiseConstructor<'SELECT_SINGLE'>
) {
  return (
    label: string,
    props: T_IO_METHOD<'SELECT_SINGLE', 'props'> & {
      onSearch: (
        query: string
      ) => Promise<T_IO_METHOD<'SELECT_SINGLE', 'returns'>[]>
    }
  ) => {
    const c = component(
      'SELECT_SINGLE',
      label,
      { options: props.options, onSearch: props.onSearch },
      async newState => {
        console.log('newState', newState)
        const filteredUsers = await props.onSearch(newState.queryTerm)
        console.log(filteredUsers)
        return { options: filteredUsers, onSearch: props.onSearch }
      }
    )

    return constructor(c)
  }
}
