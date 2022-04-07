import { z } from 'zod'

export const IO_RENDER = z.object({
  id: z.string(),
  inputGroupKey: z.string(),
  toRender: z.array(
    z.object({
      methodName: z.string(),
      label: z.string(),
      props: z.any(),
      isStateful: z.boolean().optional().default(false),
      isOptional: z.boolean().optional().default(false),
    })
  ),
  kind: z.literal('RENDER'),
})

export const IO_RESPONSE = z.object({
  id: z.string(),
  inputGroupKey: z.string().optional(),
  transactionId: z.string(),
  kind: z.union([
    z.literal('RETURN'),
    z.literal('SET_STATE'),
    z.literal('CANCELED'),
  ]),
  values: z.array(z.any()),
})

export type T_IO_RENDER = z.infer<typeof IO_RENDER>
export type T_IO_RENDER_INPUT = z.input<typeof IO_RENDER>
export type T_IO_RESPONSE = z.infer<typeof IO_RESPONSE>
export type T_IO_RESPONSE_KIND = T_IO_RESPONSE['kind']

export const typeValue = z.enum([
  'string',
  'string?',
  'number',
  'number?',
  'boolean',
  'boolean?',
])
export type TypeValue = z.infer<typeof typeValue>

const labelValue = z
  .object({
    label: z.string(),
    value: z.string(),
  })
  .passthrough()

const richSelectOption = z
  .object({
    label: z.string(),
    value: z.string(),
    description: z.string().nullish(),
    imageUrl: z.string().nullish(),
  })
  .passthrough()

const objectLiteralSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.date(),
  z.undefined(),
])

type Literal = boolean | null | number | string | Date | undefined
// `object` is workaround for https://github.com/microsoft/TypeScript/issues/15300
type KeyValue = Literal | { [key: string]: KeyValue } | KeyValue[] | object

const keyValueObject: z.ZodSchema<KeyValue> = z.lazy(() =>
  z.union([
    objectLiteralSchema,
    z.record(keyValueObject),
    z.array(keyValueObject),
    // This `any` isn't ideal, but at the end of the day this is going to be
    // passed through `JSON.serialize`, which accepts `any`.
    // Worst case scenario is something will be stringified, which is fine for display anyway.
    z.any(),
  ])
)

export const deserializableSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.undefined(),
])
export const deserializableRecord = z.record(deserializableSchema)
export type DeserializableRecord = z.infer<typeof deserializableRecord>
export const serializableSchema = deserializableSchema.or(z.date())
export const serializableRecord = z.record(serializableSchema)
export type SerializableRecord = z.infer<typeof serializableRecord>

export const tableRowValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.date(),
  z.undefined(),
  z.object({
    label: z.string(),
    href: z.string().optional(),
    value: z
      .union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.date(),
        z.undefined(),
      ])
      .optional(),
  }),
])

export const tableRow = z
  .record(tableRowValue)
  // Allow arbitrary objects/interfaces with specified column mappings.
  // If no columns specified, we'll just serialize any nested objects.
  .or(z.object({}).passthrough())

export const newInternalTableRow = z.object({
  key: z.string(),
  data: tableRow,
})

export const internalTableRow = z.union([newInternalTableRow, tableRow])

export const tableColumn = z.object({
  label: z.string(),
  render: z
    .function()
    .args(z.any())
    .returns(
      z.union([
        z.object({
          label: z.string().nullish(),
          href: z.string().optional(),
          value: z
            .union([
              z.string(),
              z.number(),
              z.boolean(),
              z.null(),
              z.date(),
              z.undefined(),
            ])
            .optional(),
        }),
        z.string(),
        z.number(),
        z.boolean(),
        z.date(),
        z.null(),
        z.undefined(),
      ])
    ),
})

export const internalTableColumn = z.object({
  label: z.string(),
})

/**
 * Any methods with an `immediate` property defined (at all, not just truthy)
 * will resolve immediately when awaited.
 */
export function resolvesImmediately(methodName: T_IO_METHOD_NAMES): boolean {
  return 'immediate' in ioSchema[methodName]
}

export const ioSchema = {
  INPUT_TEXT: {
    props: z.object({
      helpText: z.optional(z.string()),
      placeholder: z.optional(z.string()),
      defaultValue: z.optional(z.string()),
      multiline: z.optional(z.boolean()),
      lines: z.optional(z.number()),
    }),
    state: z.null(),
    returns: z.string(),
  },
  INPUT_EMAIL: {
    props: z.object({
      helpText: z.optional(z.string()),
      placeholder: z.optional(z.string()),
      defaultValue: z.optional(z.string()),
    }),
    state: z.null(),
    returns: z.string(),
  },
  INPUT_NUMBER: {
    props: z.object({
      min: z.optional(z.number()),
      max: z.optional(z.number()),
      prepend: z.optional(z.string()),
      helpText: z.optional(z.string()),
      placeholder: z.optional(z.string()),
      defaultValue: z.optional(z.number()),
      decimals: z.optional(z.number().positive().int()),
    }),
    state: z.null(),
    returns: z.number(),
  },
  INPUT_BOOLEAN: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.boolean().default(false),
    }),
    state: z.null(),
    returns: z.boolean(),
  },
  INPUT_RICH_TEXT: {
    props: z.object({
      helpText: z.optional(z.string()),
      placeholder: z.optional(z.string()),
    }),
    state: z.null(),
    returns: z.string(),
  },
  INPUT_DATE: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.optional(
        z.object({
          year: z.number(),
          month: z.number(),
          day: z.number(),
        })
      ),
    }),
    state: z.null(),
    returns: z.object({
      year: z.number(),
      month: z.number(),
      day: z.number(),
    }),
  },
  INPUT_TIME: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.optional(
        z.object({
          hour: z.number(),
          minute: z.number(),
        })
      ),
    }),
    state: z.null(),
    returns: z.object({
      hour: z.number(),
      minute: z.number(),
    }),
  },
  INPUT_DATETIME: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.optional(
        z.object({
          year: z.number(),
          month: z.number(),
          day: z.number(),
          hour: z.number(),
          minute: z.number(),
        })
      ),
    }),
    state: z.null(),
    returns: z.object({
      year: z.number(),
      month: z.number(),
      day: z.number(),
      hour: z.number(),
      minute: z.number(),
    }),
  },
  INPUT_SPREADSHEET: {
    props: z.object({
      helpText: z.string().optional(),
      columns: z.record(typeValue),
    }),
    state: z.null(),
    returns: z.array(serializableRecord),
  },
  CONFIRM: {
    props: z.object({
      helpText: z.optional(z.string()),
    }),
    state: z.null(),
    returns: z.boolean(),
    exclusive: z.literal(true),
  },
  SELECT_TABLE: {
    props: z.object({
      helpText: z.optional(z.string()),
      columns: z.optional(z.array(internalTableColumn)),
      data: z.array(internalTableRow),
    }),
    state: z.null(),
    returns: z.array(internalTableRow),
  },
  SELECT_SINGLE: {
    props: z.object({
      options: z.array(richSelectOption),
      helpText: z.optional(z.string()),
      defaultValue: z.optional(richSelectOption),
      searchable: z.optional(z.boolean()),
    }),
    state: z.object({ queryTerm: z.string() }),
    returns: richSelectOption,
  },
  SELECT_MULTIPLE: {
    props: z.object({
      options: z.array(labelValue),
      helpText: z.optional(z.string()),
      defaultValue: z
        .array(labelValue)
        .default([] as z.infer<typeof labelValue>[]),
    }),
    state: z.null(),
    returns: z.array(labelValue),
  },
  SELECT_USER: {
    props: z.object({
      userList: z.array(
        z.object({
          id: z.union([z.string(), z.number()]),
          name: z.string(),
          email: z.string().optional(),
          imageUrl: z.string().optional(),
        })
      ),
    }),
    state: z.object({ queryTerm: z.string() }),
    returns: z.object({
      id: z.union([z.string(), z.number()]),
      name: z.string(),
      email: z.string().optional(),
      imageUrl: z.string().optional(),
    }),
  },
  DISPLAY_HEADING: {
    props: z.object({}),
    state: z.null(),
    returns: z.null(),
  },
  DISPLAY_MARKDOWN: {
    props: z.object({}),
    state: z.null(),
    returns: z.null(),
  },
  DISPLAY_OBJECT: {
    props: z.object({
      data: keyValueObject,
    }),
    state: z.null(),
    returns: z.null(),
  },
  DISPLAY_TABLE: {
    props: z.object({
      helpText: z.optional(z.string()),
      columns: z.optional(z.array(internalTableColumn)),
      data: z.array(internalTableRow),
      orientation: z.enum(['vertical', 'horizontal']).default('horizontal'),
    }),
    state: z.null(),
    returns: z.null(),
  },
  DISPLAY_PROGRESS_STEPS: {
    props: z.object({
      steps: z.object({
        completed: z.number(),
        total: z.number(),
      }),
      currentStep: z.string().optional(),
      subTitle: z.string().optional(),
    }),
    state: z.null(),
    returns: z.null(),
    immediate: z.literal(true),
  },
  DISPLAY_PROGRESS_INDETERMINATE: {
    props: z.object({}),
    state: z.null(),
    returns: z.null(),
    immediate: z.literal(true),
  },
  DISPLAY_PROGRESS_THROUGH_LIST: {
    props: z.object({
      items: z.array(
        z.object({
          label: z.string(),
          isComplete: z.boolean(),
          resultDescription: z.union([z.null(), z.string()]),
        })
      ),
    }),
    state: z.null(),
    returns: z.null(),
  },
}

export type T_IO_Schema = typeof ioSchema
export type T_IO_METHOD_NAMES = keyof T_IO_Schema

type T_Fields = 'props' | 'state' | 'returns'

// prettier-ignore
export type T_IO_METHOD<
  MN extends T_IO_METHOD_NAMES,
  Field extends T_Fields
> = z.infer<T_IO_Schema[MN][Field]>

// Must use input for props with possible transformations
export type T_IO_PROPS<MN extends T_IO_METHOD_NAMES> = z.input<
  T_IO_Schema[MN]['props']
>

type JSONPrimitive = string | number | boolean | null

export type RawActionReturnData = Record<string, JSONPrimitive>

export type IOFunctionReturnType = SerializableRecord | undefined

export type ParsedActionReturnDataValue =
  | JSONPrimitive
  | {
      dataKind?: 'link'
      value: string
    }

export type ParsedActionReturnData = Record<string, ParsedActionReturnDataValue>

export type ActionResultSchema = {
  schemaVersion: 0 | 1
  status: 'SUCCESS' | 'FAILURE'
  data: IOFunctionReturnType | null
}

export type ParsedActionResultSchema = Omit<ActionResultSchema, 'data'> & {
  data: ParsedActionReturnData | null
}
