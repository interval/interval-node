import {
  T_IO_PROPS,
  T_IO_RETURNS,
  DateObject,
  DateTimeObject,
} from '../ioSchema'

function dateToDateObject(d: Date): DateObject {
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  }
}

function dateToDateTimeObject(d: Date): DateTimeObject {
  return {
    ...dateToDateObject(d),
    hour: d.getHours(),
    minute: d.getMinutes(),
  }
}

function normalizeDateObject(
  d: DateObject | Date | undefined
): DateObject | undefined {
  return d && d instanceof Date ? dateToDateObject(d) : d
}

function normalizeDateTimeObject(
  d: DateTimeObject | Date | undefined
): DateTimeObject | undefined {
  return d && d instanceof Date ? dateToDateTimeObject(d) : d
}

export function date(
  props: Omit<T_IO_PROPS<'INPUT_DATE'>, 'defaultValue' | 'min' | 'max'> & {
    defaultValue?: DateObject | Date
    min?: DateObject | Date
    max?: DateObject | Date
  }
) {
  return {
    props: {
      ...props,
      defaultValue: normalizeDateObject(props.defaultValue),
      min: normalizeDateObject(props.min),
      max: normalizeDateObject(props.max),
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
  props: Omit<T_IO_PROPS<'INPUT_DATETIME'>, 'defaultValue' | 'min' | 'max'> & {
    defaultValue?: DateTimeObject | Date
    min?: DateTimeObject | Date
    max?: DateTimeObject | Date
  }
) {
  return {
    props: {
      ...props,
      defaultValue: normalizeDateTimeObject(props.defaultValue),
      min: normalizeDateTimeObject(props.min),
      max: normalizeDateTimeObject(props.max),
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
