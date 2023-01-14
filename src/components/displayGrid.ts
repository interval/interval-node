import { T_IO_PROPS, T_IO_STATE, GridItem, InternalGridItem } from '../ioSchema'
import { filterRows, sortRows, TABLE_DATA_BUFFER_SIZE } from '../utils/table'
import { GridDataFetcher, gridItemSerializer } from '../utils/grid'

type PublicProps<Row = any> = Omit<
  T_IO_PROPS<'DISPLAY_GRID'>,
  'data' | 'totalRecords' | 'isAsync'
> & {
  renderItem: (row: Row) => GridItem
} & (
    | {
        data: Row[]
      }
    | {
        getData: GridDataFetcher<Row>
      }
  )

export default function displayGrid<Row = any>(props: PublicProps<Row>) {
  // Rendering all rows on initialization is necessary for filtering and sorting
  const initialData =
    'data' in props && props.data
      ? props.data.map((row, index) =>
          gridItemSerializer({
            key: index.toString(),
            renderItem: props.renderItem,
            row,
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
      isAsync,
    } as T_IO_PROPS<'DISPLAY_GRID'>,
    async onStateChange(newState: T_IO_STATE<'DISPLAY_GRID'>) {
      let serializedData: InternalGridItem[]
      let totalRecords: number | undefined

      if (isAsync) {
        const { data, totalRecords: r } = await props.getData(newState)
        serializedData = data.map((row, index) =>
          gridItemSerializer({
            renderItem: props.renderItem,
            key: (index + newState.offset).toString(),
            row,
          })
        )
        totalRecords = r
      } else {
        const filtered = filterRows({
          queryTerm: newState.queryTerm,
          data: initialData,
        })

        serializedData = filtered.slice(
          newState.offset,
          newState.offset +
            Math.min(newState.pageSize * 3, TABLE_DATA_BUFFER_SIZE)
        )

        totalRecords = initialData.length
      }

      return {
        ...props,
        data: serializedData,
        totalRecords,
        isAsync,
      }
    },
  }
}
