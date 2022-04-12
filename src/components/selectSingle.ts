import type { T_IO_PROPS, T_IO_RETURNS, T_IO_STATE } from '../ioSchema'

export function selectSingle<Props extends T_IO_PROPS<'SELECT_SINGLE'>>(
  props: Props
) {
  type Options = typeof props['options']
  const optionMap = new Map(props.options.map(o => [o.value, o]))

  return {
    getValue(response: T_IO_RETURNS<'SELECT_SINGLE'>) {
      return optionMap.get(response.value) as Options[0]
    },
  }
}

export default function findAndSelect<
  Props extends Omit<T_IO_PROPS<'SELECT_SINGLE'>, 'options'> & {
    initialOptions?: InputOptions
    onSearch: (query: string) => Promise<OptionsLike>
  },
  OptionsLike extends T_IO_PROPS<'SELECT_SINGLE'>['options'],
  InputOptions extends Awaited<ReturnType<Props['onSearch']>>
>(props: Props) {
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

  return {
    props: { ...rest, options },
    getValue(response: T_IO_RETURNS<'SELECT_SINGLE'>) {
      return searchedOptions.get(response.value) as Options[0]
    },
    async onStateChange(newState: T_IO_STATE<'SELECT_SINGLE'>) {
      const options = await onSearch(newState.queryTerm)

      // Could probably not await this, but could potentially cause race condition
      // where response is received before it finishes resolving, though unlikely.
      await addOptions(options)

      return { options }
    },
  }
}
