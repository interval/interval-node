import { z } from 'zod'
import Logger from '../classes/Logger'
import { tableRow, T_IO_PROPS, menuItem, T_IO_STATE } from '../ioSchema'
import { InternalMenuItem, MenuItem, TableColumn } from '../types'
import {
  columnsBuilder,
  tableRowSerializer,
  filterRows,
  sortRows,
  TABLE_DATA_BUFFER_SIZE,
  missingColumnMessage,
} from '../utils/table'

type PublicProps<Row> = Omit<
  T_IO_PROPS<'DISPLAY_TABLE'>,
  'data' | 'columns' | 'totalRecords'
> & {
  data: Row[]
  columns?: (TableColumn<Row> | string)[]
  rowMenuItems?: (row: Row) => MenuItem[]
}

export default function displayTable(logger: Logger) {
  return function displayTable<Row extends z.input<typeof tableRow> = any>(
    props: PublicProps<Row>
  ) {
    const columns = columnsBuilder(props, column =>
      logger.error(missingColumnMessage('io.display.table')(column))
    )

    // Rendering all rows on initialization is necessary for filtering and sorting
    const data = props.data.map((row, index) =>
      tableRowSerializer({
        index,
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
      } as T_IO_PROPS<'DISPLAY_TABLE'>,
      async onStateChange(newState: T_IO_STATE<'DISPLAY_TABLE'>) {
        const filtered = filterRows({
          queryTerm: newState.queryTerm,
          data,
        })

        const sorted = sortRows({
          data: filtered,
          column: newState.sortColumn ?? null,
          direction: newState.sortDirection ?? null,
        })

        return {
          ...props,
          data: sorted.slice(
            newState.offset,
            newState.offset + TABLE_DATA_BUFFER_SIZE
          ),
          totalRecords: sorted.length,
          columns: columns.map(c => ({ label: c.label })),
        }
      },
    }
  }
}
