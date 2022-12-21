import { z } from 'zod'
import Logger from '../classes/Logger'
import { tableRow, T_IO_PROPS, T_IO_RETURNS, T_IO_STATE } from '../ioSchema'
import { MenuItem, TableColumn } from '../types'
import {
  columnsBuilder,
  filterRows,
  tableRowSerializer,
  sortRows,
  TABLE_DATA_BUFFER_SIZE,
  missingColumnMessage,
} from '../utils/table'

type PublicProps<Row> = Omit<T_IO_PROPS<'SELECT_TABLE'>, 'data' | 'columns'> & {
  data: Row[]
  columns?: (TableColumn<Row> | (string & keyof Row))[]
  rowMenuItems?: (row: Row) => MenuItem[]
}

export default function selectTable(logger: Logger) {
  return function <Row extends z.input<typeof tableRow> = any>(
    props: PublicProps<Row>
  ) {
    type DataList = typeof props['data']

    const columns = columnsBuilder(props, column =>
      logger.error(missingColumnMessage('io.select.table')(column))
    )

    // Rendering all rows on initialization is necessary for filtering and sorting
    const data = props.data.map((row, index) =>
      tableRowSerializer({
        key: index.toString(),
        row,
        columns,
        menuBuilder: props.rowMenuItems,
        logger,
      })
    )

    return {
      props: {
        ...props,
        data: data.slice(0, TABLE_DATA_BUFFER_SIZE),
        totalRecords: data.length,
        columns,
      },
      getValue(response: T_IO_RETURNS<'SELECT_TABLE'>) {
        const indices = response.map(({ key }) => Number(key))
        const rows = props.data.filter((_, idx) => indices.includes(idx))
        return rows as DataList
      },
      async onStateChange(newState: T_IO_STATE<'SELECT_TABLE'>) {
        const filtered = filterRows({ queryTerm: newState.queryTerm, data })

        const sorted = sortRows({
          data: filtered,
          column: newState.sortColumn ?? null,
          direction: newState.sortDirection ?? null,
        })

        let selectedKeys: string[] = []

        if (newState.isSelectAll) {
          selectedKeys = sorted.map(({ key }) => key)
        }

        return {
          ...props,
          data: sorted.slice(
            newState.offset,
            newState.offset + TABLE_DATA_BUFFER_SIZE
          ),
          totalRecords: sorted.length,
          selectedKeys,
          columns,
        }
      },
    }
  }
}
