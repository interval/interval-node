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
    const optionMap = new Map(props.options.map(o => [o.value, o]))
    return {
      ...constructor(component('SELECT_SINGLE', label, props)),
      getValue(response) {
        return optionMap.get(response.value)
      },
    } as IOPromise<'SELECT_SINGLE', Options[0]>
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

    const options: Options = initialOptions ?? ([] as Options)

    const searchedOptions: Map<string, Options[0]> = new Map(
      options.map(o => [o.value, o])
    )

    async function addOptions(options: OptionsLike) {
      for (const option of options) {
        searchedOptions.set(option.value, option)
      }
    }

    const c = component(
      'SELECT_SINGLE',
      label,
      {
        ...rest,
        options,
      },
      onSearch
        ? async newState => {
            const options = await onSearch(newState.queryTerm)

            // Could probably not await this, but could potentially cause race condition
            // where response is received before it finishes resolving, though unlikely.
            await addOptions(options)

            return { options }
          }
        : undefined
    )

    return {
      ...constructor(c),
      getValue(response) {
        return searchedOptions.get(response.value)
      },
    } as IOPromise<'SELECT_SINGLE', Options[0]>
  }
}
