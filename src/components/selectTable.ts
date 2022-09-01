import { z } from 'zod'
import Logger from '../classes/Logger'
import {
  tableRow,
  T_IO_PROPS,
  menuItem,
  internalTableRow,
  T_IO_RETURNS,
} from '../ioSchema'
import { TableColumn } from '../types'
import { columnsBuilder, tableRowSerializer } from '../utils/table'

function missingColumnMessage(component: string) {
  return (column: string) =>
    `Provided column "${column}" not found in data for ${component}`
}

export default function selectTable(logger: Logger) {
  return function <Row extends z.input<typeof tableRow> = any>(
    props: Omit<T_IO_PROPS<'SELECT_TABLE'>, 'data' | 'columns'> & {
      data: Row[]
      columns?: (TableColumn<Row> | string)[]
      rowMenuItems?: (row: Row) => z.infer<typeof menuItem>[]
    }
  ) {
    type DataList = typeof props['data']

    const columns = columnsBuilder(props, column =>
      logger.error(missingColumnMessage('io.select.table')(column))
    )

    const data = props.data.map((row, idx) =>
      tableRowSerializer(idx, row, columns, props.rowMenuItems)
    )

    return {
      props: { ...props, data, columns },
      getValue(response: T_IO_RETURNS<'SELECT_TABLE'>) {
        const indices = response.map(row =>
          Number((row as z.infer<typeof internalTableRow>).key)
        )

        const rows = props.data.filter((_, idx) => indices.includes(idx))

        return rows as DataList
      },
    }
  }
}
