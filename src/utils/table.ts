import {
  tableColumn,
  internalTableColumn,
  tableRow,
  internalTableRow,
} from '../ioSchema'
import { MenuItem } from '../types'
import { z } from 'zod'

export const TABLE_DATA_BUFFER_SIZE = 500

/**
 * Generates column headers from rows if no columns are provided.
 */
export function columnsBuilder(
  props: {
    columns?: (z.infer<typeof tableColumn> | string)[]
    data: z.infer<typeof tableRow>[]
  },
  logMissingColumn: (column: string) => void
): z.infer<typeof tableColumn>[] {
  const dataColumns = new Set(props.data.flatMap(record => Object.keys(record)))
  if (!props.columns) {
    const labels = Array.from(dataColumns.values())

    return labels.map(label => ({
      label,
      renderCell: row => row[label],
    }))
  }

  return props.columns.map(column => {
    if (typeof column === 'string') {
      if (!dataColumns.has(column)) {
        logMissingColumn(column)
      }

      return {
        label: column,
        renderCell: row => row[column],
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
  columns: z.infer<typeof tableColumn>[]
): z.infer<typeof internalTableColumn>[] {
  return columns.map(({ renderCell, ...column }) => column)
}

const dateFormatter = new Intl.DateTimeFormat('en-US')

type RenderedTableRow = {
  [key: string]: ReturnType<z.infer<typeof tableColumn>['renderCell']>
}

/**
 * Applies cell renderers to a row.
 */
export function tableRowSerializer<T extends z.infer<typeof tableRow>>({
  index,
  row,
  columns,
  menuBuilder,
}: {
  index: number
  row: T
  columns: z.infer<typeof tableColumn>[]
  menuBuilder?: (row: T) => MenuItem[]
}): z.infer<typeof internalTableRow> {
  const key = index.toString()

  const renderedRow: RenderedTableRow = {}
  const filterValues: string[] = []

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    const val = col.renderCell(row) ?? null

    if (!!val && typeof val === 'object' && 'label' in val) {
      if (val.label === undefined) {
        val.label = null
      } else if (val.label) {
        filterValues.push(String(val.label))
      }
    } else if (val instanceof Date) {
      filterValues.push(dateFormatter.format(val))
    } else {
      filterValues.push(String(val))
    }

    renderedRow[i.toString()] = val
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
    return data.sort((a, b) => (Number(a.key) > Number(b.key) ? 1 : -1))
  }

  return data.sort((a, b) => {
    if (column === null) return 0

    const sortA = getSortableValue(direction === 'desc' ? b : a, column) ?? null
    const sortB = getSortableValue(direction === 'desc' ? a : b, column) ?? null

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
  queryTerm: string
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
