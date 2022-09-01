import { z } from 'zod'
import Logger from '../classes/Logger'
import {
  tableRow,
  T_IO_PROPS,
  menuItem,
  internalTableRow,
  T_IO_RETURNS,
  T_IO_STATE,
} from '../ioSchema'
import { TableColumn } from '../types'
import {
  columnsBuilder,
  filterRows,
  paginateRows,
  renderResults,
  sortRows,
} from '../utils/table'

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

    // Rendering all rows on initialization is necessary for filtering and sorting
    const renderedData = renderResults<Row>(props.data, columns)

    const pageSize = props.defaultPageSize ?? 20

    const paginated = paginateRows({
      page: 0,
      pageSize,
      data: renderedData,
    })

    return {
      props: {
        ...props,
        ...paginated,
        columns,
      },
      getValue(response: T_IO_RETURNS<'SELECT_TABLE'>) {
        const indices = response.map(row =>
          Number((row as z.infer<typeof internalTableRow>).key)
        )

        const rows = props.data.filter((_, idx) => indices.includes(idx))

        return rows as DataList
      },
      async onStateChange(newState: T_IO_STATE<'SELECT_TABLE'>) {
        const data = [...renderedData]

        const filtered = filterRows({ queryTerm: newState.queryTerm, data })

        const sorted = sortRows({
          data: filtered,
          column: newState.sortColumn ?? null,
          direction: newState.sortDirection ?? null,
        })

        const paginated = paginateRows({
          data: sorted,
          page: newState.page,
          pageSize: newState.pageSize ?? pageSize,
        })

        return paginated
      },
    }
  }
}
