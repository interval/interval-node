import { z } from 'zod'
import { ioSchema, TypeValue } from '../ioSchema'

type Columns = z.infer<typeof ioSchema['INPUT_SPREADSHEET']['props']>['columns']

export function extractColumns(columns: Columns) {
  const outputSchemaDef: any = {}

  for (const col of columns) {
    if (typeof col === 'string') {
      outputSchemaDef[col] = z.string()
    } else {
      outputSchemaDef[col.name] = getColumnDef(col.type)
    }
  }

  return z.array(z.object(outputSchemaDef))
}

function getColumnDef(colType: TypeValue) {
  switch (colType) {
    case 'number':
      return z.number()
    case 'number?':
      return z.number().nullable()
    case 'string':
      return z.string()
    case 'string?':
      return z.string().nullable()
    case 'boolean':
      return z.boolean()
    case 'boolean?':
      return z.boolean().nullable()
  }
}
