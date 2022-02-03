import { z } from 'zod'

export const IO_RENDER = z.object({
  id: z.string(),
  inputGroupKey: z.string(),
  toRender: z.array(
    z.object({ methodName: z.string(), label: z.string(), props: z.any() })
  ),
  kind: z.literal('RENDER'),
})

export const IO_RESPONSE = z.object({
  id: z.string(),
  transactionId: z.string(),
  kind: z.union([z.literal('RETURN'), z.literal('SET_STATE')]),
  values: z.array(z.any()),
})

export type T_IO_RENDER = z.infer<typeof IO_RENDER>
export type T_IO_RESPONSE = z.infer<typeof IO_RESPONSE>
export type T_IO_RESPONSE_KIND = T_IO_RESPONSE['kind']

const labelValue = z.object({
  label: z.string(),
  value: z.string(),
})

export const ioSchema = {
  INPUT_TEXT: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.optional(z.string()),
    }),
    state: z.null(),
    returns: z.string(),
  },
  INPUT_EMAIL: {
    props: z.object({
      helpText: z.optional(z.string()),
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
      defaultValue: z.optional(z.number()),
    }),
    state: z.null(),
    returns: z.number(),
  },
  INPUT_BOOLEAN: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.optional(z.boolean()),
    }),
    state: z.null(),
    returns: z.boolean(),
  },
  INPUT_RICH_TEXT: {
    props: z.object({
      helpText: z.optional(z.string()),
    }),
    state: z.null(),
    returns: z.string(),
  },
  SELECT_TABLE: {
    props: z.object({
      helpText: z.optional(z.string()),
      defaultValue: z.optional(
        z.array(
          z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        )
      ),
      data: z.array(
        z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      ),
    }),
    state: z.null(),
    returns: z.array(
      z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    ),
  },
  SELECT_SINGLE: {
    props: z.object({
      options: z.array(labelValue),
      helpText: z.optional(z.string()),
      defaultValue: z.optional(labelValue),
    }),
    state: z.null(),
    returns: labelValue,
  },
  SELECT_MULTIPLE: {
    props: z.object({
      options: z.array(labelValue),
      helpText: z.optional(z.string()),
      defaultValue: z.optional(z.array(labelValue)),
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

export type T_IO_METHOD<
  MN extends T_IO_METHOD_NAMES,
  Field extends T_Fields
> = z.infer<T_IO_Schema[MN][Field]>
