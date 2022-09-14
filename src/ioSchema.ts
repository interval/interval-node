import { z } from 'zod'

const buttonTheme = z.enum(['default', 'danger']).default('default').optional()
export type ButtonTheme = z.infer<typeof buttonTheme>

export const IO_RENDER = z.object({
  id: z.string(),
  inputGroupKey: z.string(),
  toRender: z.array(
    z.object({
      methodName: z.string(),
      label: z.string(),
      props: z.any(),
      propsMeta: z.any().optional(),
      isStateful: z.boolean().optional().default(false),
      isOptional: z.boolean().optional().default(false),
      validationErrorMessage: z.string().optional(),
    })
  ),
  validationErrorMessage: z.string().optional(),
  continueButton: z
    .object({
      label: z.string().optional(),
      theme: buttonTheme,
    })
    .optional(),
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
  valuesMeta: z.any().optional(),
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

export const primitiveValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.date(),
])

const objectLiteralSchema = primitiveValue.nullish()

type Literal = boolean | null | number | string | Date | undefined
// `object` is workaround for https://github.com/microsoft/TypeScript/issues/15300
type KeyValue = Literal | { [key: string]: KeyValue } | KeyValue[] | object

export const labelValue = z
  .object({
    label: primitiveValue,
    value: primitiveValue,
  })
  .passthrough()

export type LabelValue = z.infer<typeof labelValue>

export const richSelectOption = z
  .object({
    label: primitiveValue,
    value: primitiveValue,
    description: z.string().nullish(),
    imageUrl: z.string().nullish(),
  })
  .passthrough()

export type RichSelectOption = z.infer<typeof richSelectOption>

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
export type Deserializable = z.infer<typeof deserializableSchema>
export const deserializableRecord = z.record(deserializableSchema)
export type DeserializableRecord = z.infer<typeof deserializableRecord>

export const serializableSchema = deserializableSchema
  .or(z.date())
  .or(z.bigint())

export type Serializable = z.infer<typeof serializableSchema>
export const serializableRecord = z.record(serializableSchema)
export type SerializableRecord = z.infer<typeof serializableRecord>

export const tableRowValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.date(),
  z.undefined(),
  z.bigint(),
  z.object({
    label: z.string(),
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
    href: z.string().optional(),
    url: z.string().optional(),
    action: z.string().optional(),
    params: serializableRecord.optional(),
  }),
])

export const tableRow = z
  .record(tableRowValue)
  // Allow arbitrary objects/interfaces with specified column mappings.
  // If no columns specified, we'll just serialize any nested objects.
  .or(z.object({}).passthrough())

export const menuItem = z.intersection(
  z.object({
    label: z.string(),
    theme: buttonTheme,
  }),
  z.union([
    z.object({
      action: z.string(),
      params: serializableRecord.optional(),
      disabled: z.boolean().optional(),
    }),
    z.object({
      url: z.string(),
      disabled: z.boolean().optional(),
    }),
    z.object({
      disabled: z.literal(true),
    }),
  ])
)

export const linkSchema = z.union([
  z.object({
    url: z.string(),
  }),
  z.object({
    action: z.string(),
    params: serializableRecord.optional(),
  }),
])

export type LinkProps = z.infer<typeof linkSchema>

export const internalTableRow = z.object({
  key: z.string(),
  data: tableRow,
  menu: z.array(menuItem).optional(),
  // filterValue is a string we compile when we render each row, allowing us to quickly
  // filter array items without having to search all object keys for the query term.
  // It is not sent to the client.
  filterValue: z.string().optional(),
})

export const tableColumn = z.object({
  label: z.string(),
  renderCell: z
    .function()
    .args(z.any())
    .returns(
      z.union([
        z.intersection(
          z.object({
            label: z.union([
              z.string(),
              z.number(),
              z.boolean(),
              z.date(),
              z.null(),
              z.undefined(),
            ]),
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
          z.union([
            z.object({
              url: z.string(),
            }),
            z.object({
              href: z.string(),
            }),
            z.object({
              action: z.string(),
              params: serializableRecord.optional(),
            }),
            z.object({}),
          ])
        ),
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

export const CURRENCIES = [
  'USD',
  'CAD',
  'EUR',
  'GBP',
  'AUD',
  'CNY',
  'JPY',
] as const
export const currencyCode = z.enum(CURRENCIES)
export type CurrencyCode = z.infer<typeof currencyCode>

export const imageSize = z.enum(['thumbnail', 'small', 'medium', 'large'])
export type ImageSize = z.infer<typeof imageSize>

export const dateObject = z.object({
  year: z.number(),
  month: z.number(),
  day: z.number(),
})
export type DateObject = z.infer<typeof dateObject>
export const timeObject = z.object({
  hour: z.number(),
  minute: z.number(),
})
export type TimeObject = z.infer<typeof timeObject>
export const dateTimeObject = dateObject.merge(timeObject)
export type DateTimeObject = z.infer<typeof dateTimeObject>

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
      minLength: z.optional(z.number().int().positive()),
      maxLength: z.optional(z.number().int().positive()),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.string(),
  },
  INPUT_EMAIL: {
    props: z.object({
      helpText: z.optional(z.string()),
      placeholder: z.optional(z.string()),
      defaultValue: z.optional(z.string()),
      disabled: z.optional(z.boolean().default(false)),
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
      currency: z.optional(currencyCode),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.number(),
  },
  INPUT_URL: {
    props: z.object({
      helpText: z.optional(z.string()),
      placeholder: z.optional(z.string()),
      defaultValue: z.optional(z.string()),
      allowedProtocols: z.array(z.string()).default(['http', 'https']),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.string(),
  },
  INPUT_BOOLEAN: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.boolean().default(false),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.boolean(),
  },
  INPUT_RICH_TEXT: {
    props: z.object({
      helpText: z.optional(z.string()),
      placeholder: z.optional(z.string()),
      defaultValue: z.optional(z.string()),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.string(),
  },
  INPUT_DATE: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.optional(dateObject),
      min: z.optional(dateObject),
      max: z.optional(dateObject),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: dateObject,
  },
  INPUT_TIME: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.optional(timeObject),
      min: z.optional(timeObject),
      max: z.optional(timeObject),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: timeObject,
  },
  INPUT_DATETIME: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.optional(dateTimeObject),
      min: z.optional(dateTimeObject),
      max: z.optional(dateTimeObject),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: dateTimeObject,
  },
  INPUT_SPREADSHEET: {
    props: z.object({
      helpText: z.string().optional(),
      defaultValue: z.optional(z.array(deserializableRecord)),
      columns: z.record(typeValue),
    }),
    state: z.null(),
    returns: z.array(deserializableRecord),
  },
  UPLOAD_FILE: {
    props: z.object({
      helpText: z.string().optional(),
      allowedExtensions: z.array(z.string()).optional(),
      uploadUrl: z.string().nullish().optional(),
      downloadUrl: z.string().nullish().optional(),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.object({
      name: z.string(),
      type: z.string(),
    }),
    returns: z.object({
      name: z.string(),
      type: z.string(),
      lastModified: z.number(),
      size: z.number(),
      url: z.string(),
    }),
  },
  SEARCH: {
    props: z.object({
      results: z.array(
        z.object({
          value: z.string(),
          label: primitiveValue,
          description: z.string().nullish(),
          imageUrl: z.string().nullish(),
        })
      ),
      placeholder: z.optional(z.string()),
      helpText: z.optional(z.string()),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.object({ queryTerm: z.string() }),
    returns: z.string(),
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
      columns: z.array(internalTableColumn),
      data: z.array(internalTableRow),
      defaultPageSize: z.number().optional(),
      minSelections: z.optional(z.number().int().min(0)),
      maxSelections: z.optional(z.number().positive().int()),
      disabled: z.optional(z.boolean().default(false)),
      //== private props
      // added in v0.28, optional until required by all active versions
      totalRecords: z.optional(z.number().int()),
      selectedKeys: z.array(z.string()).default([]),
    }),
    state: z.object({
      queryTerm: z.string(),
      sortColumn: z.string().nullish(),
      sortDirection: z.enum(['asc', 'desc']).nullish(),
      offset: z.number().int().default(0),
      isSelectAll: z.boolean().default(false),
    }),
    // replaced full rows with just keys in v0.28
    returns: z.union([
      z.array(internalTableRow),
      z.array(z.object({ key: z.string() })),
    ]),
  },
  SELECT_SINGLE: {
    props: z.object({
      options: z.array(richSelectOption),
      helpText: z.optional(z.string()),
      defaultValue: z.optional(richSelectOption),
      searchable: z.optional(z.boolean()),
      disabled: z.optional(z.boolean().default(false)),
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
      minSelections: z.optional(z.number().int().min(0)),
      maxSelections: z.optional(z.number().positive().int()),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.array(labelValue),
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
  DISPLAY_IMAGE: {
    props: z.object({
      alt: z.string().optional(),
      width: imageSize.optional(),
      height: imageSize.optional(),
      url: z.string(),
    }),
    state: z.null(),
    returns: z.null(),
  },
  DISPLAY_LINK: {
    props: z.intersection(
      z.object({
        theme: buttonTheme,
      }),
      z.union([
        z.object({
          href: z.string(),
        }),
        linkSchema,
      ])
    ),
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
      columns: z.array(internalTableColumn),
      data: z.array(internalTableRow),
      orientation: z.enum(['vertical', 'horizontal']).default('horizontal'),
      defaultPageSize: z.number().optional(),
      //== private props
      // added in v0.28, optional until required by all active versions
      totalRecords: z.optional(z.number().int()),
    }),
    state: z.object({
      queryTerm: z.string(),
      sortColumn: z.string().nullish(),
      sortDirection: z.enum(['asc', 'desc']).nullish(),
      offset: z.number().int().default(0),
    }),
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
  DISPLAY_VIDEO: {
    props: z.object({
      width: imageSize.optional(),
      height: imageSize.optional(),
      url: z.string(),
      loop: z.boolean().optional(),
      muted: z.boolean().optional(),
    }),
    state: z.null(),
    returns: z.null(),
  },
}

export type IoMethod = {
  props: z.ZodTypeAny
  state: z.ZodTypeAny
  returns: z.ZodTypeAny
}

export type T_IO_Schema = typeof ioSchema
export type T_IO_METHOD_NAMES = keyof T_IO_Schema

export type T_IO_DISPLAY_METHOD_NAMES =
  | 'DISPLAY_HEADING'
  | 'DISPLAY_MARKDOWN'
  | 'DISPLAY_LINK'
  | 'DISPLAY_OBJECT'
  | 'DISPLAY_TABLE'

export type T_IO_INPUT_METHOD_NAMES = Exclude<
  T_IO_METHOD_NAMES,
  T_IO_DISPLAY_METHOD_NAMES
>

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

export type T_IO_RETURNS<MN extends T_IO_METHOD_NAMES> = z.infer<
  T_IO_Schema[MN]['returns']
>

export type T_IO_STATE<MN extends T_IO_METHOD_NAMES> = z.infer<
  T_IO_Schema[MN]['state']
>

type JSONPrimitive = string | number | boolean | null

export type RawActionReturnData = Record<string, JSONPrimitive>

export type IOFunctionReturnType =
  | SerializableRecord
  | Serializable[]
  | Serializable
  | undefined

export type ParsedActionReturnDataValue =
  | JSONPrimitive
  | {
      dataKind?: 'link'
      value: string
    }

export type ParsedActionReturnData =
  | Record<string, ParsedActionReturnDataValue>
  | ParsedActionReturnDataValue

export type ActionResultSchema = {
  schemaVersion: 0 | 1
  status: 'SUCCESS' | 'FAILURE'
  data: IOFunctionReturnType | null
  meta?: any
}

export type ParsedActionResultSchema = Omit<ActionResultSchema, 'data'> & {
  data: ParsedActionReturnData | null
}
