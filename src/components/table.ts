import { z } from 'zod'
import {
  T_IO_PROPS,
  tableColumn,
  tableRow,
  newInternalTableRow,
  T_IO_RETURNS,
} from '../ioSchema'
import { columnsBuilder, tableRowSerializer } from '../utils/table'

// Overrides internal schema with user-facing defs for columns & data
type InputProps = Omit<T_IO_PROPS<'SELECT_TABLE'>, 'data' | 'columns'> & {
  columns?: z.input<typeof tableColumn>[]
  data: z.input<typeof tableRow>[]
}

export function selectTable<Props extends InputProps>(props: Props) {
  type DataList = typeof props['data']

  const columns = columnsBuilder(props)

  const data = props.data.map((row, idx) =>
    tableRowSerializer(idx, row, columns)
  )

  return {
    props: { ...props, data, columns },
    getValue(response: T_IO_RETURNS<'SELECT_TABLE'>) {
      const indices = response.map(row =>
        Number((row as z.infer<typeof newInternalTableRow>).key)
      )

      const rows = props.data.filter((_, idx) => indices.includes(idx))

      return rows as DataList
    },
  }
}

export function displayTable<Props extends InputProps>(props: Props) {
  const columns = columnsBuilder(props)

  const data = props.data.map((row, idx) =>
    tableRowSerializer(idx, row, columns)
  )

  return {
    props: {
      ...props,
      data,
      columns,
    },
  }
}
