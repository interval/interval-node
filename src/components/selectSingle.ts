import { z } from 'zod'
import { T_IO_PROPS, T_IO_RETURNS, richSelectOption } from '../ioSchema'
import Logger from '../classes/Logger'

type SelectSingleProps<
  Option extends z.infer<typeof richSelectOption> | string
> = Omit<T_IO_PROPS<'SELECT_SINGLE'>, 'options' | 'defaultValue'> & {
  options: Option[]
  defaultValue?: Option
}

export default function selectSingle(logger: Logger) {
  return <Option extends z.infer<typeof richSelectOption> | string>(
    props: SelectSingleProps<Option>
  ) => {
    const normalizedOptions = props.options.map(option => {
      if (typeof option === 'string') {
        return {
          label: option,
          value: option,
        }
      } else {
        return option as Exclude<Option, string>
      }
    })

    type Options = typeof props.options
    const optionMap = new Map(
      normalizedOptions.map((o, i) => [o.value, props.options[i]])
    )
    const stripper = richSelectOption.strip()

    let defaultValue =
      typeof props.defaultValue === 'string'
        ? {
            label: props.defaultValue,
            value: props.defaultValue,
          }
        : (props.defaultValue as Exclude<Option, string> | undefined)

    if (defaultValue && !optionMap.has(defaultValue.value)) {
      logger.warn(
        'The defaultValue property must be a value in the provided options, the provided defaultValue will be discarded.'
      )
      defaultValue = undefined
    }

    return {
      props: {
        ...props,
        defaultValue: defaultValue ? stripper.parse(defaultValue) : undefined,
        options: normalizedOptions.map(o => stripper.parse(o)),
      },
      getValue(response: T_IO_RETURNS<'SELECT_SINGLE'>) {
        return optionMap.get(response.value) as Options[0]
      },
    }
  }
}
