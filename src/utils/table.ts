import { tableRow, T_IO_PROPS } from '../ioSchema'
import { z } from 'zod'

/**
 * Removes formatter functions & generates headers from keys if none are provided
 */
export function columnsBuilder(props: T_IO_PROPS<'SELECT_TABLE'>) {
  if (!props.columns) {
    return Array.from(
      new Set(props.data.flatMap(record => Object.keys(record))).values()
    ).map(key => ({ key, label: key }))
  }

  return props.columns.map(({ formatter, ...rest }) => {
    return {
      ...rest,
      label: rest.label ?? rest.key,
    }
  })
}

/**
 * Applies column selectors & formatters to a row of table data
 */
export function tableRowSerializer(
  row: T_IO_PROPS<'SELECT_TABLE'>['data'][0],
  columns: T_IO_PROPS<'SELECT_TABLE'>['columns']
) {
  if (!columns) return row

  const finalRow: { [key: string]: any } = {}

  for (const { key, formatter } of columns) {
    if (formatter) {
      // this is a private object schema that we use to store the original value inside the row.
      // when this data is returned to us, we'll replace the object with the value of `_value`.
      finalRow[key] = { _label: formatter(row[key]), _value: row[key] }
    } else {
      finalRow[key] = row[key]
    }
  }

  return finalRow
}

/**
 * Transforms a `tableRow` and its private _key/_label properties back into the original object shape.
 */
export function tableRowDeserializer(rows: z.infer<typeof tableRow>[]) {
  return rows.map(row => {
    return Object.keys(row).reduce<{ [key: string]: any }>((result, key) => {
      const v = row[key]

      if (v && typeof v === 'object' && '_label' in v) {
        result[key] = v._value
      } else {
        result[key] = v
      }

      return result
    }, {})
  })
}
