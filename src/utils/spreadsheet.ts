import { z } from 'zod'
import { ioSchema } from '../ioSchema'

export function extractColumns<
  Props extends z.infer<typeof ioSchema['INPUT_SPREADSHEET']['props']>,
  Columns extends Props['columns']
>(columns: Columns) {
  type OutputType = {
    [key in keyof Columns]: typeof COLUMN_DEFS[Columns[key]]
  }

  const outputSchemaDef: any = {}

  for (const [col, typeDef] of Object.entries(columns)) {
    outputSchemaDef[col] = COLUMN_DEFS[typeDef]
  }

  return z.array(z.object(outputSchemaDef as OutputType))
}

export const COLUMN_DEFS = {
  number: z.number(),
  'number?': z.number().nullable(),
  string: z.string(),
  'string?': z.string().nullable(),
  boolean: z.boolean(),
  'boolean?': z.boolean().nullable(),
}
