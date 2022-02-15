import component from '../component'
import type { T_IO_METHOD } from '../ioSchema'
import type { IOPromiseConstructor } from '../io'

export default function findAndSelect(
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
    const c = component('SELECT_SINGLE', label, props, async newState => {
      const options = await props.onSearch(newState.queryTerm)
      return { options }
    })

    return constructor(c)
  }
}
