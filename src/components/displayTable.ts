import { z } from 'zod'
import Logger from '../classes/Logger'
import { tableRow, T_IO_PROPS, T_IO_STATE, internalTableRow } from '../ioSchema'
import { MenuItem, TableColumn } from '../types'
import {
  columnsBuilder,
  tableRowSerializer,
  filterRows,
  sortRows,
  TABLE_DATA_BUFFER_SIZE,
  missingColumnMessage,
  TableDataFetcher,
  columnsWithoutRender,
} from '../utils/table'

type PublicProps<Row extends z.infer<typeof tableRow>> = Omit<
  T_IO_PROPS<'DISPLAY_TABLE'>,
  'data' | 'columns' | 'totalRecords' | 'isAsync'
> & {
  columns?: (TableColumn<Row> | string)[]
  rowMenuItems?: (row: Row) => MenuItem[]
} & (
    | {
        data: Row[]
      }
    | {
        getData: TableDataFetcher<Row>
      }
  )

export default function displayTable(logger: Logger) {
  return function displayTable<Row extends z.input<typeof tableRow> = any>(
    props: PublicProps<Row>
  ) {
    const initialColumns = columnsBuilder(props, column =>
      logger.warn(missingColumnMessage('io.display.table')(column))
    )

    // Rendering all rows on initialization is necessary for filtering and sorting
    const initialData =
      'data' in props && props.data
        ? props.data.map((row, index) =>
            tableRowSerializer({
              key: index.toString(),
              row,
              columns: initialColumns,
              menuBuilder: props.rowMenuItems,
              logger,
            })
          )
        : []

    const isAsync = 'getData' in props && !!props.getData

    return {
      props: {
        ...props,
        data: initialData.slice(0, TABLE_DATA_BUFFER_SIZE),
        totalRecords:
          'data' in props && props.data ? initialData.length : undefined,
        columns: columnsWithoutRender(initialColumns),
        isAsync,
      } as T_IO_PROPS<'DISPLAY_TABLE'>,
      async onStateChange(newState: T_IO_STATE<'DISPLAY_TABLE'>) {
        let serializedData: z.infer<typeof internalTableRow>[]
        let builtColumns: TableColumn<Row>[]
        let totalRecords: number | undefined

        if (isAsync) {
          const { data, totalRecords: r } = await props.getData(newState)
          builtColumns = columnsBuilder(
            {
              columns: props.columns,
              data,
            },
            column =>
              logger.warn(missingColumnMessage('io.display.table')(column))
          )
          serializedData = data.map((row, index) =>
            tableRowSerializer({
              key: (index + newState.offset).toString(),
              row,
              columns: builtColumns,
              menuBuilder: props.rowMenuItems,
              logger,
            })
          )
          totalRecords = r
        } else {
          const filtered = filterRows({
            queryTerm: newState.queryTerm,
            data: initialData,
          })

          const sorted = sortRows({
            data: filtered,
            column: newState.sortColumn ?? null,
            direction: newState.sortDirection ?? null,
          })

          serializedData = sorted.slice(
            newState.offset,
            newState.offset +
              Math.min(newState.pageSize * 3, TABLE_DATA_BUFFER_SIZE)
          )

          builtColumns = initialColumns
          totalRecords = initialData.length
        }

        return {
          ...props,
          data: serializedData,
          totalRecords,
          isAsync,
          columns: columnsWithoutRender(builtColumns),
        }
      },
    }
  }
}
