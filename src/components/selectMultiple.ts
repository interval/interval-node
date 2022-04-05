import { T_IO_PROPS } from '../ioSchema'
import component from '../component'
import type { IOPromiseConstructor, IOPromise } from '../io'

export default function selectMultiple(
  constructor: IOPromiseConstructor<'SELECT_MULTIPLE'>
) {
  return <Props extends T_IO_PROPS<'SELECT_MULTIPLE'>>(
    label: string,
    props: Props
  ) => {
    type Options = typeof props['options']

    const optionMap = new Map(props.options.map(o => [o.value, o]))

    return {
      ...constructor(component('SELECT_MULTIPLE', label, props)),
      getValue(response) {
        return response.map(r => optionMap.get(r.value))
      },
    } as IOPromise<'SELECT_MULTIPLE', Options>
  }
}
