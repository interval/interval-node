import { z } from 'zod'
import { T_IO_PROPS, T_IO_RETURNS, richSelectOption } from '../ioSchema'

type SelectSingleProps = Omit<
  T_IO_PROPS<'SELECT_SINGLE'>,
  'options' | 'defaultValue'
> & {
  options: (z.infer<typeof richSelectOption> | string)[]
  defaultValue?: z.infer<typeof richSelectOption> | string
}

export default function selectSingle<Props extends SelectSingleProps>(
  props: Props
) {
  const options = props.options.map(option => {
    if (typeof option === 'string') {
      return {
        label: option,
        value: option,
      }
    } else {
      return option
    }
  })

  type Options = typeof options
  const optionMap = new Map(options.map(o => [o.value, o]))
  const stripper = richSelectOption.strip()

  const defaultValue =
    typeof props.defaultValue === 'string'
      ? {
          label: props.defaultValue,
          value: props.defaultValue,
        }
      : props.defaultValue

  return {
    props: {
      ...props,
      defaultValue: defaultValue ? stripper.parse(defaultValue) : undefined,
      options: options.map(o => stripper.parse(o)),
    },
    getValue(response: T_IO_RETURNS<'SELECT_SINGLE'>) {
      return optionMap.get(response.value) as Options[0]
    },
  }
}
