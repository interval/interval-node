import { z } from 'zod'

export const IO_CALL = z.object({
  id: z.string(),
  toRender: z.array(z.object({ methodName: z.string(), inputs: z.any() })),
  kind: z.literal('CALL'),
})

export const IO_RESPONSE = z.object({
  id: z.string(),
  responseValues: z.array(z.any()),
  kind: z.literal('RESPONSE'),
})

const labelValue = z.object({
  label: z.string(),
  value: z.string(),
})

export type IOCall = z.infer<typeof IO_CALL>
export type IOResponse = z.infer<typeof IO_RESPONSE>

export const ioSchema = {
  INPUT_TEXT: {
    inputs: z.object({
      label: z.string(),
      prepend: z.optional(z.string()),
    }),
    returns: z.string(),
  },
  INPUT_EMAIL: {
    inputs: z.object({
      label: z.string(),
    }),
    returns: z.string(),
  },
  DISPLAY_HEADING: {
    inputs: z.object({
      label: z.string(),
    }),
    returns: z.null(),
  },
  DISPLAY_PROGRESS_THROUGH_LIST: {
    inputs: z.object({
      label: z.string(),
      items: z.array(
        z.object({
          label: z.string(),
          isComplete: z.boolean(),
          resultDescription: z.union([z.null(), z.string()]),
        })
      ),
    }),
    returns: z.null(),
  },
  SELECT_TABLE: {
    inputs: z.object({
      label: z.optional(z.string()),
      data: z.array(
        z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      ),
    }),
    returns: z.array(
      z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    ),
  },
  INPUT_NUMBER: {
    inputs: z.object({
      min: z.optional(z.number()),
      max: z.optional(z.number()),
      prepend: z.optional(z.string()),
      label: z.string(),
    }),
    returns: z.number(),
  },
  INPUT_BOOLEAN: {
    inputs: z.object({
      label: z.string(),
      helpText: z.optional(z.string()),
      defaultValue: z.optional(z.boolean()),
    }),
    returns: z.boolean(),
  },
  SELECT_SINGLE: {
    inputs: z.object({
      label: z.string(),
      options: z.array(labelValue),
      helpText: z.optional(z.string()),
      defaultValue: z.optional(labelValue),
    }),
    returns: labelValue,
  },
  SELECT_MULTIPLE: {
    inputs: z.object({
      label: z.string(),
      options: z.array(labelValue),
      defaultValue: z.optional(z.array(labelValue)),
    }),
    returns: z.array(labelValue),
  },
}
