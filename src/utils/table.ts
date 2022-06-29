import {
  tableColumn,
  internalTableColumn,
  tableRow,
  internalTableRow,
} from '../ioSchema'
import { z } from 'zod'

/**
 * Generates column headers from rows if no columns are provided.
 */
export function columnsBuilder(props: {
  columns?: (z.infer<typeof tableColumn> | string)[]
  data: z.infer<typeof tableRow>[]
}): z.infer<typeof tableColumn>[] {
  if (!props.columns) {
    const labels = Array.from(
      new Set(props.data.flatMap(record => Object.keys(record))).values()
    )

    return labels.map(label => ({
      label,
      renderCell: row => row[label],
    }))
  }

  return props.columns.map(column => {
    if (typeof column === 'string') {
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
export function tableRowSerializer(
  idx: number,
  row: z.infer<typeof tableRow>,
  columns: z.infer<typeof tableColumn>[]
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
  }
}
