import { z } from 'zod'

export const DISPLAY_COMPONENT_TO_RENDER = z.object({
  methodName: z.string(),
  label: z.string(),
  props: z.any(),
  propsMeta: z.any().optional(),
  isStateful: z.boolean().optional().default(false),
})

export type DisplayComponentToRender = z.infer<
  typeof DISPLAY_COMPONENT_TO_RENDER
>

export const INPUT_COMPONENT_TO_RENDER = DISPLAY_COMPONENT_TO_RENDER.merge(
  z.object({
    isMultiple: z.boolean().optional().default(false),
    isOptional: z.boolean().optional().default(false),
    validationErrorMessage: z.string().nullish(),
    multipleProps: z
      .optional(
        z.object({
          defaultValue: z.optional(z.array(z.any())).nullable(),
        })
      )
      .nullable(),
  })
)

export const COMPONENT_TO_RENDER = INPUT_COMPONENT_TO_RENDER
export type ComponentToRender = z.infer<typeof COMPONENT_TO_RENDER>

export const DISPLAY_RENDER = z.object({
  id: z.string(),
  inputGroupKey: z.string(),
  toRender: z.array(DISPLAY_COMPONENT_TO_RENDER),
  kind: z.literal('RENDER'),
})

// `default` deprecated in 0.31.0
const buttonTheme = z.enum(['default', 'primary', 'secondary', 'danger'])
export type ButtonTheme = 'primary' | 'secondary' | 'danger'

export const IO_RENDER = z.object({
  id: z.string(),
  inputGroupKey: z.string(),
  toRender: z.array(COMPONENT_TO_RENDER),
  validationErrorMessage: z.string().nullish(),
  choiceButtons: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        theme: buttonTheme.optional(),
      })
    )
    .nullish(),
  continueButton: z
    .object({
      label: z.string().optional(),
      theme: buttonTheme.optional(),
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
  choice: z.string().optional(),
  values: z.array(z.any()),
  valuesMeta: z.any().optional(),
})

export type T_IO_RENDER = z.infer<typeof IO_RENDER>
export type T_IO_RENDER_INPUT = z.input<typeof IO_RENDER>
export type T_DISPLAY_RENDER = z.infer<typeof DISPLAY_RENDER>
export type T_DISPLAY_RENDER_INPUT = z.input<typeof DISPLAY_RENDER>

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

export type Literal = boolean | null | number | string | Date | undefined
// `object` is workaround for https://github.com/microsoft/TypeScript/issues/15300
type KeyValue = Literal | { [key: string]: KeyValue } | KeyValue[] | object

export const labelValue = z
  .object({
    label: primitiveValue,
    value: primitiveValue,
  })
  .passthrough()

export type LabelValue = z.infer<typeof labelValue>

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

export const imageSize = z.enum(['thumbnail', 'small', 'medium', 'large'])
export type ImageSize = z.infer<typeof imageSize>

export const imageSchema = z.object({
  alt: z.string().optional(),
  size: imageSize.optional(),
  // deprecated/undocumented in 0.33.0
  width: imageSize.optional(),
  // deprecated/undocumented in 0.33.0
  height: imageSize.optional(),
  url: z.string(),
})
export type ImageSchema = z.infer<typeof imageSchema>

export const richSelectOption = z
  .object({
    label: primitiveValue,
    value: primitiveValue,
    description: z.string().nullish(),
    imageUrl: z.string().nullish(),
    image: imageSchema.optional(),
  })
  .passthrough()

export type RichSelectOption = z.infer<typeof richSelectOption>

export const highlightColor = z.enum([
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'gray',
])

export type HighlightColor = z.infer<typeof highlightColor>

// non-primitive display types such as links, images, etc.
export const advancedPrimitive = z.object({
  label: z.string().optional(),
  url: z.string().optional(),
  image: imageSchema.optional(),
  action: z.string().optional(),
  params: serializableRecord.optional(),
})

export const tableRowValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.date(),
  z.undefined(),
  z.bigint(),
  z
    .object({
      label: z.string().optional(),
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
      image: imageSchema.optional(),
      // Deprecated in favor of route
      action: z.string().optional(),
      route: z.string().optional(),
      params: serializableRecord.optional(),
      highlightColor: highlightColor.optional(),
    })
    .passthrough(),
])

// Allow arbitrary objects/interfaces with specified column mappings.
// If no columns specified, we'll just serialize any nested objects.
export const tableRow = z.record(tableRowValue.or(z.any()))

export const menuItem = z.intersection(
  z.object({
    label: z.string(),
    // `default` deprecated in 0.31.0
    theme: z.enum(['default', 'danger']).optional(),
  }),
  z.union([
    z.intersection(
      z.object({
        params: serializableRecord.optional(),
        disabled: z.boolean().optional(),
      }),
      z.union([
        z.object({
          route: z.string(),
        }),
        z.object({
          // deprecated in favor of `route`
          action: z.string(),
        }),
      ])
    ),
    z.object({
      url: z.string(),
      disabled: z.boolean().optional(),
    }),
    z.object({
      disabled: z.literal(true),
    }),
  ])
)

export const buttonItem = z.intersection(
  z.object({
    label: z.string(),
    theme: buttonTheme.optional(),
  }),
  z.union([
    z.intersection(
      z.object({
        params: serializableRecord.optional(),
        disabled: z.boolean().optional(),
      }),
      z.union([
        z.object({
          route: z.string(),
        }),
        z.object({
          // deprecated in favor of `route`
          action: z.string(),
        }),
      ])
    ),
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
    route: z.string(),
    params: serializableRecord.optional(),
  }),
])

export type LinkProps = z.infer<typeof linkSchema>

// TODO: Remove soon
export const legacyLinkSchema = z.union([
  linkSchema,
  z.object({
    action: z.string(),
    params: serializableRecord.optional(),
  }),
])

export type LegacyLinkProps = z.infer<typeof legacyLinkSchema>

export const internalTableRow = z.object({
  key: z.string(),
  data: tableRow,
  menu: z.array(menuItem).optional(),
  // filterValue is a string we compile when we render each row, allowing us to quickly
  // filter array items without having to search all object keys for the query term.
  // It is not sent to the client.
  filterValue: z.string().optional(),
})

export const internalTableColumn = z.object({
  label: z.string(),
  accessorKey: z.string().optional(),
})

export const gridItem = z.object({
  label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  image: z
    .object({
      url: z.string().nullable().optional(),
      alt: z.string().optional(),
      fit: z.enum(['cover', 'contain']).optional(),
      aspectRatio: z.number().optional(),
    })
    .nullable()
    .optional(),
  menu: z.array(menuItem).optional(),
  url: z.string().optional(),
  route: z.string().optional(),
  params: serializableRecord.optional(),
})

export const backwardCompatibleGridItem = gridItem.merge(
  z.object({
    // @deprecated in favor of label
    title: z.string().nullable().optional(),
  })
)

export const internalGridItem = z.object({
  data: backwardCompatibleGridItem,
  key: z.string(),
  filterValue: z.string().optional(),
})

export type GridItem = z.input<typeof gridItem>
export type BackwardCompatibleGridItem = z.input<
  typeof backwardCompatibleGridItem
>
export type InternalGridItem = z.infer<typeof internalGridItem>

const searchResult = z.object({
  value: z.string(),
  label: primitiveValue,
  description: z.string().nullish(),
  imageUrl: z.string().nullish(),
  image: imageSchema.optional(),
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
export function resolvesImmediately(
  methodName: T_IO_METHOD_NAMES,
  {
    displayResolvesImmediately = false,
  }: { displayResolvesImmediately?: boolean } = {}
): boolean {
  if (displayResolvesImmediately && methodName.startsWith('DISPLAY_'))
    return true

  const schema = ioSchema[methodName]
  return schema && 'immediate' in schema && schema.immediate
}

export function supportsMultiple(methodName: T_IO_METHOD_NAMES): boolean {
  const schema = ioSchema[methodName]
  return schema && 'supportsMultiple' in schema && schema.supportsMultiple
}

export function requiresServer(methodName: T_IO_METHOD_NAMES): boolean {
  const schema = ioSchema[methodName]
  return schema && 'requiresServer' in schema && schema.requiresServer
}

export const metaItemSchema = z.object({
  label: z.string(),
  value: primitiveValue.or(z.bigint()).nullish().optional(),
  url: z.string().optional(),
  image: imageSchema.optional(),
  route: z.string().optional(),
  // Deprecated in favor of `route` above
  action: z.string().optional(),
  params: serializableRecord.optional(),
  error: z.string().nullish(),
})

const DISPLAY_SCHEMA = {
  DISPLAY_CODE: {
    props: z.object({
      code: z.string(),
      language: z.string().optional(),
    }),
    state: z.null(),
    returns: z.null(),
  },
  DISPLAY_HEADING: {
    props: z.object({
      level: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
      description: z.string().optional(),
      menuItems: z.array(buttonItem).optional(),
    }),
    state: z.null(),
    returns: z.null(),
  },
  DISPLAY_METADATA: {
    props: z.object({
      data: z.array(metaItemSchema),
      layout: z.enum(['grid', 'list', 'card']).optional().default('grid'),
    }),
    state: z.null(),
    returns: z.null(),
  },
  DISPLAY_MARKDOWN: {
    props: z.object({}),
    state: z.null(),
    returns: z.null(),
  },
  DISPLAY_HTML: {
    props: z.object({
      html: z.string(),
    }),
    state: z.null(),
    returns: z.null(),
  },
  DISPLAY_IMAGE: {
    props: imageSchema,
    state: z.null(),
    returns: z.null(),
  },
  DISPLAY_LINK: {
    props: z.intersection(
      z.object({
        theme: buttonTheme.optional(),
      }),
      z.union([
        z.object({
          href: z.string(),
        }),
        legacyLinkSchema,
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
  DISPLAY_GRID: {
    props: z.object({
      data: z.array(internalGridItem),
      idealColumnWidth: z.optional(z.number()),
      defaultPageSize: z.number().optional(),
      helpText: z.optional(z.string()),
      isFilterable: z.boolean().default(true),
      //== private props
      totalRecords: z.optional(z.number().int()),
      isAsync: z.optional(z.boolean().default(false)),
    }),
    state: z.object({
      queryTerm: z.string().optional(),
      offset: z.number().int().default(0),
      pageSize: z.number().int(),
    }),
    returns: z.null(),
  },
  DISPLAY_TABLE: {
    props: z.object({
      helpText: z.optional(z.string()),
      columns: z.array(internalTableColumn),
      data: z.array(internalTableRow),
      orientation: z.enum(['vertical', 'horizontal']).default('horizontal'),
      defaultPageSize: z.number().optional(),
      isSortable: z.boolean().default(true),
      isFilterable: z.boolean().default(true),
      //== private props
      // added in v0.28, optional until required by all active versions
      totalRecords: z.optional(z.number().int()),
      isAsync: z.optional(z.boolean().default(false)),
    }),
    state: z.object({
      queryTerm: z.string().optional(),
      sortColumn: z.string().optional(),
      sortDirection: z.enum(['asc', 'desc']).optional(),
      offset: z.number().int().default(0),
      pageSize: z.number().int(),
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
    immediate: true,
  },
  DISPLAY_PROGRESS_INDETERMINATE: {
    props: z.object({}),
    state: z.null(),
    returns: z.null(),
    immediate: true,
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

const INPUT_SCHEMA = {
  INPUT_TEXT: {
    props: z.object({
      helpText: z.optional(z.string()),
      placeholder: z.optional(z.string()),
      defaultValue: z.optional(z.string()).nullable(),
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
      defaultValue: z.optional(z.string()).nullable(),
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
      defaultValue: z.optional(z.number()).nullable(),
      decimals: z.optional(z.number().positive().int()),
      currency: z.optional(currencyCode),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.number(),
  },
  INPUT_SLIDER: {
    props: z.object({
      min: z.number(),
      max: z.number(),
      step: z.optional(z.number()),
      helpText: z.optional(z.string()),
      defaultValue: z.optional(z.number()).nullable(),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.number(),
  },
  INPUT_URL: {
    props: z.object({
      helpText: z.optional(z.string()),
      placeholder: z.optional(z.string()),
      defaultValue: z.optional(z.string()).nullable(),
      allowedProtocols: z.array(z.string()).default(['http', 'https']),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.string(),
  },
  INPUT_BOOLEAN: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z
        .boolean()
        .nullable()
        .default(false)
        .transform(val => !!val),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.boolean(),
  },
  INPUT_RICH_TEXT: {
    props: z.object({
      helpText: z.optional(z.string()),
      placeholder: z.optional(z.string()),
      defaultValue: z.optional(z.string()).nullable(),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.string(),
  },
  INPUT_DATE: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.optional(dateObject).nullable(),
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
      defaultValue: z.optional(timeObject).nullable(),
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
      defaultValue: z.optional(dateTimeObject).nullable(),
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
      defaultValue: z.optional(z.array(deserializableRecord)).nullable(),
      columns: z.record(typeValue),
    }),
    state: z.null(),
    returns: z.array(deserializableRecord),
  },
  UPLOAD_FILE: {
    props: z.object({
      helpText: z.string().optional(),
      allowedExtensions: z.array(z.string()).optional(),
      disabled: z.optional(z.boolean().default(false)),
      fileUrls: z
        .array(
          z.object({
            uploadUrl: z.string(),
            downloadUrl: z.string(),
          })
        )
        .nullish(),

      // Deprecated
      uploadUrl: z.string().nullish().optional(),
      downloadUrl: z.string().nullish().optional(),
    }),
    state: z.object({
      files: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
          })
        )
        .optional(),

      // Deprecated
      name: z.string().optional(),
      type: z.string().optional(),
    }),
    returns: z.object({
      name: z.string(),
      type: z.string(),
      lastModified: z.number(),
      size: z.number(),
      url: z.string(),
    }),
    supportsMultiple: true,
  },
  SEARCH: {
    props: z.object({
      results: z.array(searchResult),
      defaultValue: z.optional(z.string()).nullable(),
      placeholder: z.optional(z.string()),
      helpText: z.optional(z.string()),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.object({ queryTerm: z.string() }),
    returns: z.string(),
    supportsMultiple: true,
  },
  CONFIRM: {
    props: z.object({
      helpText: z.optional(z.string()),
    }),
    state: z.null(),
    returns: z.boolean(),
    exclusive: z.literal(true),
  },
  CONFIRM_IDENTITY: {
    props: z.object({
      gracePeriodMs: z.number().optional(),
    }),
    state: z.null(),
    returns: z.boolean(),
    exclusive: z.literal(true),
    requiresServer: true,
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
      isSortable: z.optional(z.boolean().default(true)),
      isFilterable: z.optional(z.boolean().default(true)),
      //== private props
      // added in v0.28, optional until required by all active versions
      totalRecords: z.optional(z.number().int()),
      selectedKeys: z.array(z.string()).default([]),
    }),
    state: z.object({
      queryTerm: z.string().nullish(),
      sortColumn: z.string().nullish(),
      sortDirection: z.enum(['asc', 'desc']).nullish(),
      offset: z.number().int().default(0),
      pageSize: z.number().int(),
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
      defaultValue: z.optional(richSelectOption).nullable(),
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
        .nullable()
        .default([] as z.infer<typeof labelValue>[])
        .transform(val => val ?? []),
      minSelections: z.optional(z.number().int().min(0)),
      maxSelections: z.optional(z.number().positive().int()),
      disabled: z.optional(z.boolean().default(false)),
    }),
    state: z.null(),
    returns: z.array(labelValue),
  },
  CREDENTIALS: {
    props: z.object({
      // optional service-specific params to pass to the API
      params: z.optional(z.record(z.string())),
    }),
    state: z.null(),
    returns: z.object({
      token: z.string(),
      // only returned for OAuth 1.0 APIs
      secret: z.string().optional(),
    }),
  },
}

export const ioSchema = {
  ...DISPLAY_SCHEMA,
  ...INPUT_SCHEMA,
}

export type IoMethod = {
  props: z.ZodTypeAny
  state: z.ZodTypeAny
  returns: z.ZodTypeAny
}

export type T_IO_Schema = typeof ioSchema
export type T_IO_METHOD_NAMES = keyof T_IO_Schema

export type T_IO_DISPLAY_METHOD_NAMES = keyof typeof DISPLAY_SCHEMA
export type T_IO_INPUT_METHOD_NAMES = keyof typeof INPUT_SCHEMA

type SupportsMultipleMap = {
  [MN in T_IO_METHOD_NAMES]: T_IO_Schema[MN] extends {
    supportsMultiple: boolean
  }
    ? MN
    : never
}

export type T_IO_MULTIPLEABLE_METHOD_NAMES =
  SupportsMultipleMap[T_IO_METHOD_NAMES]

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

export type JSONPrimitive = string | number | boolean | null

export type RawActionReturnData = Record<string, JSONPrimitive>

export type IOFunctionReturnType =
  | SerializableRecord
  | Serializable[]
  | Serializable
  | undefined

export type ParsedActionReturnData =
  | Record<string, JSONPrimitive>
  | JSONPrimitive

export type ActionResultSchema = {
  schemaVersion: 0 | 1
  status: 'SUCCESS' | 'FAILURE'
  data: IOFunctionReturnType | null
  meta?: any
}

export type ParsedActionResultSchema = Omit<ActionResultSchema, 'data'> & {
  data: ParsedActionReturnData | null
}
