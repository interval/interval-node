import { z } from 'zod'
import { T_IO_PROPS, T_IO_RETURNS, labelValue } from '../ioSchema'

type SelectMultipleProps = Omit<
  T_IO_PROPS<'SELECT_MULTIPLE'>,
  'options' | 'defaultValue'
> & {
  options: (z.infer<typeof labelValue> | string)[]
  defaultValue?: (z.infer<typeof labelValue> | string)[]
}

export default function selectMultiple<Props extends SelectMultipleProps>(
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

  const defaultValue = props.defaultValue?.map(d => {
    if (typeof d === 'string') {
      return {
        label: d,
        value: d,
      }
    } else {
      return d
    }
  })

  const stripper = labelValue.strip()

  return {
    props: {
      ...props,
      defaultValue: defaultValue?.map(o => stripper.parse(o)),
      options: options.map(o => stripper.parse(o)),
    },
    getValue(response: T_IO_RETURNS<'SELECT_MULTIPLE'>): Options {
      return response.map(r => optionMap.get(r.value)) as Options
    },
  }
}
