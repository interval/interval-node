import { T_IO_PROPS, T_IO_RETURNS } from '../ioSchema'

export function date(
  props: Omit<T_IO_PROPS<'INPUT_DATE'>, 'defaultValue'> & {
    defaultValue?: T_IO_PROPS<'INPUT_DATE'>['defaultValue'] | Date
  }
) {
  let defaultValue: T_IO_PROPS<'INPUT_DATE'>['defaultValue']

  if (props.defaultValue && props.defaultValue instanceof Date) {
    const d = props.defaultValue
    defaultValue = {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    }
  } else {
    defaultValue = props.defaultValue
  }
  return {
    props: {
      ...props,
      defaultValue,
    },
    getValue(response: T_IO_RETURNS<'INPUT_DATE'>) {
      const jsDate = new Date(
        response.year,
        response.month - 1,
        response.day,
        0,
        0,
        0,
        0
      )

      return {
        ...response,
        jsDate,
      }
    },
  }
}

export function datetime(
  props: Omit<T_IO_PROPS<'INPUT_DATETIME'>, 'defaultValue'> & {
    defaultValue?: T_IO_PROPS<'INPUT_DATETIME'>['defaultValue'] | Date
  }
) {
  let defaultValue: T_IO_PROPS<'INPUT_DATETIME'>['defaultValue']

  if (props.defaultValue && props.defaultValue instanceof Date) {
    const d = props.defaultValue
    defaultValue = {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    }
  } else {
    defaultValue = props.defaultValue
  }
  return {
    props: {
      ...props,
      defaultValue,
    },
    getValue(response: T_IO_RETURNS<'INPUT_DATETIME'>) {
      const jsDate = new Date(
        response.year,
        response.month - 1,
        response.day,
        response.hour,
        response.minute,
        0,
        0
      )

      return {
        ...response,
        jsDate,
      }
    },
  }
}
