import { z } from 'zod'
import { T_IO_PROPS, T_IO_RETURNS, labelValue } from '../ioSchema'

type SelectMultipleProps<Option extends z.infer<typeof labelValue> | string> =
  Omit<T_IO_PROPS<'SELECT_MULTIPLE'>, 'options' | 'defaultValue'> & {
    options: Option[]
    defaultValue?: Option[]
  }

export default function selectMultiple<
  Option extends z.infer<typeof labelValue> | string
>(props: SelectMultipleProps<Option>) {
  const normalizedOptions: z.infer<typeof labelValue>[] = props.options.map(
    option => {
      if (typeof option === 'string') {
        return {
          label: option,
          value: option,
        }
      } else {
        return option as Exclude<Option, string>
      }
    }
  )
  type Options = typeof props.options
  const optionMap = new Map(
    normalizedOptions.map((o, i) => [o.value, props.options[i]])
  )

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
      options: normalizedOptions.map(o => stripper.parse(o)),
    },
    getValue(response: T_IO_RETURNS<'SELECT_MULTIPLE'>): Options {
      return response.map(r => optionMap.get(r.value)) as Options
    },
  }
}
