import { z } from 'zod'
import type { T_IO_PROPS, T_IO_RETURNS } from '../ioSchema'
import { COLUMN_DEFS } from '../utils/spreadsheet'

export default function spreadsheet<
  Props extends T_IO_PROPS<'INPUT_SPREADSHEET'>
>(_props: Props) {
  type Columns = Props['columns']

  return {
    getValue(response: T_IO_RETURNS<'INPUT_SPREADSHEET'>) {
      return response as {
        [key in keyof Columns]: z.infer<typeof COLUMN_DEFS[Columns[key]]>
      }[]
    },
  }
}
