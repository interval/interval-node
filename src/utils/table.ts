import { internalTableColumn, tableRow, internalTableRow } from '../ioSchema'
import { MenuItem } from '../types'
import { z } from 'zod'
import { TableColumn, TableColumnResult } from '../types'
import { bufferToDataUrl } from './image'
import Logger from '../classes/Logger'

export const TABLE_DATA_BUFFER_SIZE = 500

/**
 * Generates column headers from rows if no columns are provided.
 */
export function columnsBuilder<Row extends z.infer<typeof tableRow>>(
  props: {
    columns?: (TableColumn<Row> | string)[]
    data?: Row[]
  },
  logMissingColumn: (column: string) => void
): TableColumn<Row>[] {
  const dataColumns = props.data
    ? new Set(props.data.flatMap(record => Object.keys(record)))
    : new Set<string>()

  if (!props.columns) {
    const labels = Array.from(dataColumns.values())

    return labels.map(label => ({
      label,
      accessorKey: label,
    }))
  }

  return props.columns.map(column => {
    const accessorKey = typeof column === 'string' ? column : column.accessorKey
    if (accessorKey && !dataColumns.has(accessorKey)) {
      logMissingColumn(accessorKey)
    }

    if (typeof column === 'string') {
      return {
        label: column,
        accessorKey: column,
      }
    } else {
      return column
    }
  })
}

/**
 * Removes the `render` function from column defs before sending data up to the server.
 */
export function columnsWithoutRender(
  columns: TableColumn<any>[]
): z.infer<typeof internalTableColumn>[] {
  return columns.map(({ renderCell, ...column }) => column)
}

const dateFormatter = new Intl.DateTimeFormat('en-US')

type RenderedTableRow = {
  [key: string]: TableColumnResult
}

export type TableDataFetcher<Row extends z.infer<typeof tableRow>> = (props: {
  queryTerm?: string | null
  sortColumn?: string | null
  sortDirection?: 'asc' | 'desc' | null
  offset: number
  pageSize: number
}) => Promise<{ data: Row[]; totalRecords?: number }>

export function getColumnKey(
  col: { label?: string; accessorKey?: string },
  keyOccurrances: Map<string, number>
): string {
  let key = col.accessorKey ?? col.label ?? ''
  const keyNum = keyOccurrances.get(key)
  if (keyNum !== undefined) {
    key = `${key} (${keyNum})`
    keyOccurrances.set(key, keyNum + 1)
  } else {
    keyOccurrances.set(key, 1)
  }

  return key
}

/**
 * Applies cell renderers to a row.
 */
export function tableRowSerializer<Row extends z.infer<typeof tableRow>>({
  key,
  row,
  columns,
  menuBuilder,
  logger,
}: {
  key: string
  row: Row
  columns: TableColumn<Row>[]
  menuBuilder?: (row: Row) => MenuItem[]
  logger: Logger
}): z.infer<typeof internalTableRow> {
  const renderedRow: RenderedTableRow = {}
  const filterValues: string[] = []

  const colKeys = new Map<string, number>()

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    const key = getColumnKey(col, colKeys)
    const val =
      col.renderCell?.(row) ??
      (col.accessorKey ? row[col.accessorKey as string] : null)

    if (val && typeof val === 'object' && 'image' in val) {
      const image = val.image

      if (image) {
        if (image.size) {
          if (!image.width) {
            image.width = image.size
          }

          if (!image.height) {
            image.height = image.size
          }
        }

        if ('buffer' in image) {
          const { buffer, ...rest } = image
          try {
            val.image = {
              ...rest,
              url: bufferToDataUrl(buffer),
            }
          } catch (err) {
            logger.error(err)
            delete val.image
          }
        }
      }
    }

    if (val && typeof val === 'object' && 'label' in val) {
      if (val.label === undefined) {
        val.label = null
      } else if (val.label) {
        filterValues.push(
          val.label instanceof Date
            ? dateFormatter.format(val.label)
            : String(val.label)
        )
      }
    } else if (val instanceof Date) {
      filterValues.push(dateFormatter.format(val))
    } else {
      filterValues.push(String(val))
    }

    renderedRow[key] = val
  }

  return {
    key,
    data: renderedRow,
    filterValue: filterValues.join(' ').toLowerCase(),
    menu: menuBuilder ? menuBuilder(row) : undefined,
  }
}

type IsomorphicTableRow = {
  data: Record<string, any>
  key: string
  filterValue?: string
}

export function sortRows<T extends IsomorphicTableRow>({
  data,
  column,
  direction,
}: {
  data: T[]
  column: string | null
  direction: 'asc' | 'desc' | null
}): T[] {
  if (column === null || direction === null) {
    return data.sort((a, b) => Number(a.key) - Number(b.key))
  }

  return data.sort((a, b) => {
    if (column === null) return 0

    const sortA = getSortableValue(direction === 'desc' ? b : a, column) ?? null
    const sortB = getSortableValue(direction === 'desc' ? a : b, column) ?? null

    if (sortA === null && sortB === null) return 0
    if (sortA === null) return 1
    if (sortB === null) return -1

    if (typeof sortA === 'string' && typeof sortB === 'string') {
      return sortA.localeCompare(sortB, undefined, { numeric: true })
    }
    if (sortA < sortB) return -1
    if (sortA > sortB) return 1

    return 0
  })
}

function getSortableValue<T extends IsomorphicTableRow>(
  row: T,
  sortByColumn: string
): string | null {
  let sortVal

  if (row !== null && 'data' in row && row.data) {
    if (sortByColumn in row.data) {
      sortVal = (row.data as Record<string, any>)[sortByColumn] ?? null
    }
  }

  if (sortVal && typeof sortVal === 'object') {
    if ('value' in sortVal) {
      return sortVal.value
    }
    if ('label' in sortVal) {
      return sortVal.label
    }
  }

  return sortVal
}

export function filterRows<T extends IsomorphicTableRow>({
  queryTerm,
  data,
}: {
  queryTerm?: string | null
  data: T[]
}): Omit<T, 'filterValue'>[] {
  if (!queryTerm) return data

  return (
    data
      .filter(row => {
        if ('filterValue' in row && typeof row.filterValue === 'string') {
          return row.filterValue.includes(queryTerm.toLowerCase())
        }
        return true
      })
      // filterValue is unnecessary beyond this point
      .map(({ filterValue, ...row }) => row)
  )
}

export function missingColumnMessage(component: string) {
  return (column: string) =>
    `Provided column "${column}" not found in data for ${component}`
}
