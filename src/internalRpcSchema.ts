import { z } from 'zod'
import { serializableRecord } from './ioSchema'

export const DUPLEX_MESSAGE_SCHEMA = z.object({
  id: z.string(),
  methodName: z.string(),
  data: z.any(),
  kind: z.enum(['CALL', 'RESPONSE']),
})

export type DuplexMessage = z.infer<typeof DUPLEX_MESSAGE_SCHEMA>

export const TRANSACTION_RESULT_SCHEMA_VERSION = 1

export const actionEnvironment = z.enum(['live', 'development'])

export type ActionEnvironment = z.infer<typeof actionEnvironment>

export const ENQUEUE_ACTION = {
  inputs: z.object({
    slug: z.string(),
    assignee: z.string().nullish(),
    params: serializableRecord.nullish(),
  }),
  returns: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('success'),
      id: z.string(),
    }),
    z.object({
      type: z.literal('error'),
      message: z.string(),
    }),
  ]),
}

export const DEQUEUE_ACTION = {
  inputs: z.object({
    id: z.string(),
  }),
  returns: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('success'),
      id: z.string(),
      assignee: z.string().optional(),
      params: serializableRecord.optional(),
    }),
    z.object({
      type: z.literal('error'),
      message: z.string(),
    }),
  ]),
}

export const wsServerSchema = {
  CONNECT_TO_TRANSACTION_AS_CLIENT: {
    inputs: z.object({
      transactionId: z.string(),
      instanceId: z.string(),
    }),
    returns: z.boolean(),
  },
  RESPOND_TO_IO_CALL: {
    inputs: z.object({
      transactionId: z.string(),
      ioResponse: z.string(),
    }),
    returns: z.boolean(),
  },
  SEND_IO_CALL: {
    inputs: z.object({
      transactionId: z.string(),
      ioCall: z.string(),
    }),
    returns: z.boolean(),
  },
  SEND_LOG: {
    inputs: z.object({
      transactionId: z.string(),
      data: z.string(),
      index: z.number().optional(),
      timestamp: z.number().optional(),
    }),
    returns: z.boolean(),
  },
  MARK_TRANSACTION_COMPLETE: {
    inputs: z.object({
      transactionId: z.string(),
      result: z.string().optional(),
    }),
    returns: z.boolean(),
  },
  INITIALIZE_HOST: {
    inputs: z.object({
      apiKey: z.string(),
      // Actually slugs, for backward compatibility
      // TODO: Change to slug in breaking release
      callableActionNames: z.array(z.string()),
      sdkName: z.string().optional(),
      sdkVersion: z.string().optional(),
    }),
    returns: z
      .object({
        environment: actionEnvironment,
        invalidSlugs: z.array(z.string()),
        dashboardUrl: z.string(),
      })
      .nullable(),
  },
  ENQUEUE_ACTION: {
    inputs: z.object({
      // Actually slugs, for backward compatibility
      // TODO: Change to slug in breaking release
      actionName: z.string(),
      assignee: z.string().nullish(),
      params: serializableRecord.nullish(),
    }),
    returns: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('success'),
        id: z.string(),
      }),
      z.object({
        type: z.literal('error'),
        message: z.string(),
      }),
    ]),
  },
  DEQUEUE_ACTION: {
    inputs: z.object({
      id: z.string(),
    }),
    returns: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('success'),
        id: z.string(),
        assignee: z.string().optional(),
        params: serializableRecord.optional(),
      }),
      z.object({
        type: z.literal('error'),
        message: z.string(),
      }),
    ]),
  },
}

export type WSServerSchema = typeof wsServerSchema

export const clientSchema = {
  CLIENT_USURPED: {
    inputs: z.undefined(),
    returns: z.void().nullable(),
  },
  TRANSACTION_COMPLETED: {
    inputs: z.undefined(),
    returns: z.void().nullable(),
  },
  HOST_CLOSED_UNEXPECTEDLY: {
    inputs: z.undefined(),
    returns: z.void().nullable(),
  },
  HOST_RECONNECTED: {
    inputs: z.undefined(),
    returns: z.void().nullable(),
  },
  RENDER: {
    inputs: z.object({
      toRender: z.string(),
    }),
    returns: z.boolean(),
  },
  LOG: {
    inputs: z.object({
      data: z.string().nullable(),
      index: z.number(),
      timestamp: z.number(),
    }),
    returns: z.boolean(),
  },
}

export type ClientSchema = typeof clientSchema

export const hostSchema = {
  IO_RESPONSE: {
    inputs: z.object({
      value: z.string(),
      transactionId: z.string(),
    }),
    returns: z.void().nullable(),
  },
  START_TRANSACTION: {
    inputs: z.object({
      transactionId: z.string(),
      // Actually slug, for backward compatibility
      // TODO: Change to slug in breaking release
      actionName: z.string(),
      environment: actionEnvironment,
      user: z.object({
        email: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
      }),
      params: serializableRecord,
    }),
    returns: z.void().nullable(),
  },
}

export type HostSchema = typeof hostSchema
