import { z } from 'zod'

export const ioSchema = {
  ASK_TEXT: {
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
  ASK_CONFIRM: {
    inputs: z.object({
      question: z.string(),
    }),
    returns: z.boolean(),
  },
  // SELECT_FROM_TABULAR_DATA: {
  //   inputs: z.object({
  //     data: z.array(
  //       z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
  //     ),
  //   }),
  //   returns: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  // },
  // ASK_NUMBER: {
  //   inputs: z.object({
  //     min: z.number(),
  //     max: z.number(),
  //     label: z.string(),
  //   }),
  //   returns: z.number(),
  // },
  // ASK_MULTIPLE: {
  //   inputs: z.object({
  //     label: z.string(),
  //     options: z.array(
  //       z.union([
  //         z.string(),
  //         z.object({ label: z.string(), value: z.string() }),
  //       ])
  //     ),
  //   }),
  //   returns: z.string(),
  // },
}
