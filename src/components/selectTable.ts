import { T_IO_METHOD } from '../ioSchema'
import component from '../component'
import type { IOPromiseConstructor } from '../io'

export default function selectTable(
  constructor: IOPromiseConstructor<'SELECT_TABLE'>
) {
  return <
    Props extends T_IO_METHOD<'SELECT_TABLE', 'props'>,
    DataList extends Props['data']
  >(
    label: string,
    props: Props
  ) => {
    const ioPromise = constructor(component('SELECT_TABLE', label, props))

    const _output = undefined as DataList | undefined

    return {
      ...ioPromise,
      _output,
    }
  }
}
