import { T_IO_PROPS } from '../ioSchema'
import component from '../component'
import type { IOPromiseConstructor, IOPromise } from '../io'

export function date(constructor: IOPromiseConstructor<'INPUT_DATE'>) {
  return <Props extends T_IO_PROPS<'INPUT_DATE'>>(
    label: string,
    props?: Props
  ) => {
    return {
      ...constructor(component('INPUT_DATE', label, props)),
      getValue(response) {
        const jsDate = new Date(response.year, response.month, response.day)

        return {
          ...response,
          jsDate,
        }
      },
    } as IOPromise<
      'INPUT_DATE',
      // Need to redefine inline here to improve user type hints,
      // an intersection bleeds through to the hint
      {
        year: number
        month: number
        day: number
        jsDate: Date
      }
    >
  }
}

export function datetime(constructor: IOPromiseConstructor<'INPUT_DATETIME'>) {
  return <Props extends T_IO_PROPS<'INPUT_DATETIME'>>(
    label: string,
    props?: Props
  ) => {
    return {
      ...constructor(component('INPUT_DATETIME', label, props)),
      getValue(response) {
        const jsDate = new Date(
          response.year,
          response.month,
          response.day,
          response.hour,
          response.minute
        )

        return {
          ...response,
          jsDate,
        }
      },
    } as IOPromise<
      'INPUT_DATETIME',
      {
        year: number
        month: number
        day: number
        hour: number
        minute: number
        jsDate: Date
      }
    >
  }
}
