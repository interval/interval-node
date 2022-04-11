import { T_IO_PROPS, T_IO_RETURNS } from '../ioSchema'

export default function selectMultiple<
  Props extends T_IO_PROPS<'SELECT_MULTIPLE'>
>(props: Props) {
  type Options = typeof props['options']

  const optionMap = new Map(props.options.map(o => [o.value, o]))

  return {
    getValue(response: T_IO_RETURNS<'SELECT_MULTIPLE'>): Options {
      return response.map(r => optionMap.get(r.value)) as Options
    },
  }
}
