import { T_IO_RETURNS } from '../ioSchema'

export function date() {
  return {
    getValue(response: T_IO_RETURNS<'INPUT_DATE'>) {
      const jsDate = new Date(response.year, response.month - 1, response.day)

      return {
        ...response,
        jsDate,
      }
    },
  }
}

export function datetime() {
  return {
    getValue(response: T_IO_RETURNS<'INPUT_DATETIME'>) {
      const jsDate = new Date(
        response.year,
        response.month - 1,
        response.day,
        response.hour,
        response.minute
      )

      return {
        ...response,
        jsDate,
      }
    },
  }
}
