import { z } from 'zod'
import {
  T_IO_PROPS,
  tableColumn,
  tableRow,
  newInternalTableRow,
  T_IO_RETURNS,
  serializableRecord,
} from '../ioSchema'
import { columnsBuilder, tableRowSerializer } from '../utils/table'

type CellValue = string | number | boolean | null | Date | undefined

type ColumnResult =
  | ({
      label: string | null | undefined
      value?: CellValue
    } & (
      | {}
      | { href: string }
      | { action: string; params?: z.infer<typeof serializableRecord> }
    ))
  | CellValue

interface Column<Row> extends z.input<typeof tableColumn> {
  label: string
  renderCell: (row: Row) => ColumnResult
}

export function selectTable<Row extends z.input<typeof tableRow> = any>(
  props: Omit<T_IO_PROPS<'SELECT_TABLE'>, 'data' | 'columns'> & {
    data: Row[]
    columns?: Column<Row>[]
  }
) {
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

export function displayTable<Row = any>(
  props: Omit<T_IO_PROPS<'DISPLAY_TABLE'>, 'data' | 'columns'> & {
    data: Row[]
    columns?: Column<Row>[]
  }
) {
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
