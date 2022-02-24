import component from '../component'
import type { T_IO_PROPS } from '../ioSchema'
import type { IOPromiseConstructor, IOPromise } from '../io'

export function selectSingle(
  constructor: IOPromiseConstructor<'SELECT_SINGLE'>
) {
  return <
    Props extends T_IO_PROPS<'SELECT_SINGLE'>,
    Options extends Props['options']
  >(
    label: string,
    props: Props
  ) => {
    return constructor(component('SELECT_SINGLE', label, props)) as IOPromise<
      'SELECT_SINGLE',
      Options[0]
    >
  }
}

export default function findAndSelect(
  constructor: IOPromiseConstructor<'SELECT_SINGLE'>
) {
  return <
    Props extends T_IO_PROPS<'SELECT_SINGLE'> & {
      onSearch?: (query: string) => Promise<Options>
    },
    Options extends Props['options']
  >(
    label: string,
    props: Props
  ) => {
    const { onSearch, ...rest } = props
    const c = component(
      'SELECT_SINGLE',
      label,
      rest,
      onSearch
        ? async newState => {
            const options = await onSearch(newState.queryTerm)
            return { options }
          }
        : undefined
    )

    return constructor(c) as IOPromise<'SELECT_SINGLE', Options[0]>
  }
}
