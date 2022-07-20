import { z } from 'zod'
import {
  T_IO_PROPS,
  T_IO_RETURNS,
  richSelectOption,
  primitiveValue,
} from '../ioSchema'
import Logger from '../classes/Logger'

type SelectSingleProps<
  Option extends
    | z.infer<typeof richSelectOption>
    | z.infer<typeof primitiveValue>
> = Omit<T_IO_PROPS<'SELECT_SINGLE'>, 'options' | 'defaultValue'> & {
  options: Option[]
  defaultValue?: Option
}

export default function selectSingle(logger: Logger) {
  return <
    Option extends
      | z.infer<typeof richSelectOption>
      | z.infer<typeof primitiveValue>
  >(
    props: SelectSingleProps<Option>
  ) => {
    function normalizeOption(option: Option) {
      if (
        typeof option === 'string' ||
        typeof option === 'number' ||
        typeof option === 'boolean' ||
        option instanceof Date
      ) {
        return {
          label: option,
          value: option,
        }
      } else {
        return option as Exclude<Option, string | number | boolean | Date>
      }
    }

    function getComparisonValue(value: z.infer<typeof primitiveValue>) {
      if (value instanceof Date) {
        return `date:${value.valueOf()}`
      }

      return `${typeof value}:${value}`
    }

    const normalizedOptions = props.options.map(option =>
      normalizeOption(option)
    )

    type Options = typeof props.options
    const optionMap = new Map(
      normalizedOptions.map((o, i) => [
        getComparisonValue(o.value),
        props.options[i],
      ])
    )
    const stripper = richSelectOption.strip()

    let defaultValue = props.defaultValue
      ? normalizeOption(props.defaultValue)
      : undefined

    if (
      defaultValue &&
      !optionMap.has(getComparisonValue(defaultValue.value))
    ) {
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
        return optionMap.get(getComparisonValue(response.value)) as Options[0]
      },
    }
  }
}
