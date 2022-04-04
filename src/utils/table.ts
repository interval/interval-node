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
  columns?: z.infer<typeof tableColumn>[]
  data: z.infer<typeof tableRow>[]
}): z.infer<typeof internalTableColumn>[] {
  if (!props.columns) {
    return Array.from(
      new Set(props.data.flatMap(record => Object.keys(record))).values()
    ).map(key => ({ label: key }))
  }

  return props.columns
}

/**
 * Applies cell renderers to a row.
 */
export function tableRowSerializer(
  idx: number,
  row: z.infer<typeof tableRow>,
  columns?: z.infer<typeof tableColumn>[]
): z.infer<typeof internalTableRow> {
  const key = idx.toString()

  if (!columns) {
    return {
      key,
      data: row,
    }
  }

  const finalRow: { [key: string]: any } = {}

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    const val = col.render(row) ?? null
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
