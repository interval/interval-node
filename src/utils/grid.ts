import { GridItem, InternalGridItem } from '../ioSchema'

export type GridDataFetcher<Row = any> = (props: {
  queryTerm?: string
  offset: number
  pageSize: number
}) => Promise<{ data: Row[]; totalRecords?: number }>

const dateFormatter = new Intl.DateTimeFormat('en-US')

export function gridItemSerializer<Row = any>({
  key,
  row,
  renderItem,
}: {
  key: string
  row: Row
  renderItem: (row: Row) => GridItem
}): InternalGridItem {
  let filterValues: string[] = []

  if (row && typeof row === 'object') {
    filterValues = Object.values(row).map(v =>
      v instanceof Date ? dateFormatter.format(v) : String(v)
    )
  }

  return {
    key,
    data: renderItem(row),
    filterValue: filterValues.join(' ').toLowerCase(),
  }
}
