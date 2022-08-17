import {
  tableColumn,
  internalTableColumn,
  tableRow,
  internalTableRow,
  menuItem,
} from '../ioSchema'
import { z } from 'zod'
import Logger from '../classes/Logger'

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

/**
 * Applies cell renderers to a row.
 */
export function tableRowSerializer<T extends z.infer<typeof tableRow>>(
  idx: number,
  row: T,
  columns: z.infer<typeof tableColumn>[],
  menuBuilder?: (row: T) => z.infer<typeof menuItem>[]
): z.infer<typeof internalTableRow> {
  const key = idx.toString()

  const finalRow: { [key: string]: any } = {}

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    const val = col.renderCell(row) ?? null
    if (
      !!val &&
      typeof val === 'object' &&
      'label' in val &&
      val.label === undefined
    ) {
      val.label = null
    }
    finalRow[i.toString()] = val
  }

  return {
    key,
    data: finalRow,
    menu: menuBuilder ? menuBuilder(row) : undefined,
  }
}
