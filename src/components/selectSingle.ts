import component from '../component'
import type { T_IO_PROPS } from '../ioSchema'
import type { IOPromiseConstructor, IOPromise } from '../io'

export function selectSingle(
  constructor: IOPromiseConstructor<'SELECT_SINGLE'>
) {
  return <Props extends T_IO_PROPS<'SELECT_SINGLE'>>(
    label: string,
    props: Props
  ) => {
    type Options = typeof props['options']
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
    Props extends Omit<T_IO_PROPS<'SELECT_SINGLE'>, 'options'> & {
      initialOptions?: InputOptions
      onSearch: (query: string) => Promise<OptionsLike>
    },
    OptionsLike extends T_IO_PROPS<'SELECT_SINGLE'>['options'],
    InputOptions extends Awaited<ReturnType<Props['onSearch']>>
  >(
    label: string,
    props: Props
  ) => {
    type Options = Awaited<ReturnType<typeof props['onSearch']>>
    const { onSearch, initialOptions, ...rest } = props
    const c = component(
      'SELECT_SINGLE',
      label,
      {
        ...rest,
        options: initialOptions ?? [],
      },
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
