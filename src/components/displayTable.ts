import { z } from 'zod'
import Logger from '../classes/Logger'
import { tableRow, T_IO_PROPS, menuItem, T_IO_STATE } from '../ioSchema'
import { TableColumn } from '../types'
import {
  columnsBuilder,
  renderResults,
  paginateRows,
  filterRows,
  sortRows,
} from '../utils/table'

type PublicProps<Row> = Omit<
  T_IO_PROPS<'DISPLAY_TABLE'>,
  'data' | 'columns' | 'totalPages' | 'totalRecords'
> & {
  data: Row[]
  columns?: (TableColumn<Row> | string)[]
  rowMenuItems?: (row: Row) => z.infer<typeof menuItem>[]
}

function missingColumnMessage(component: string) {
  return (column: string) =>
    `Provided column "${column}" not found in data for ${component}`
}

export default function displayTable(logger: Logger) {
  return function displayTable<Row extends z.input<typeof tableRow> = any>(
    props: PublicProps<Row>
  ) {
    const columns = columnsBuilder(props, column =>
      logger.error(missingColumnMessage('io.display.table')(column))
    )

    // Rendering all rows on initialization is necessary for filtering and sorting
    const renderedData = renderResults<Row>(props.data, columns)

    const pageSize =
      props.defaultPageSize ?? (props.orientation === 'vertical' ? 5 : 20)

    const pagination = paginateRows({
      page: 0,
      pageSize,
      data: renderedData,
    })

    return {
      props: {
        ...props,
        ...pagination,
        columns,
      },
      async onStateChange(newState: T_IO_STATE<'DISPLAY_TABLE'>) {
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
