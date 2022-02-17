import { z } from 'zod'

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
      callableActionSlugs: z.array(z.string()),
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
      slug: z.string(),
      assignee: z.string().optional(),
      params: z.record(z.string()).optional(),
    }),
    returns: z.union([
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
    returns: z.union([
      z.object({
        type: z.literal('success'),
        id: z.string(),
        assignee: z.string().optional(),
        params: z.record(z.string()).optional(),
      }),
      z.object({
        type: z.literal('error'),
        message: z.string(),
      }),
    ]),
  },
}

export const clientSchema = {
  CLIENT_USURPED: {
    inputs: z.undefined(),
    returns: z.void(),
  },
  TRANSACTION_COMPLETED: {
    inputs: z.undefined(),
    returns: z.void(),
  },
  HOST_CLOSED_UNEXPECTEDLY: {
    inputs: z.undefined(),
    returns: z.void(),
  },
  HOST_RECONNECTED: {
    inputs: z.undefined(),
    returns: z.void(),
  },
  RENDER: {
    inputs: z.object({
      toRender: z.string(),
    }),
    returns: z.boolean(),
  },
}

export const hostSchema = {
  IO_RESPONSE: {
    inputs: z.object({
      value: z.string(),
      transactionId: z.string(),
    }),
    returns: z.void(),
  },
  START_TRANSACTION: {
    inputs: z.object({
      transactionId: z.string(),
      slug: z.string(),
      environment: actionEnvironment,
      user: z.object({
        email: z.string(),
        firstName: z.string(),
        lastName: z.string(),
      }),
      params: z.record(z.string()),
    }),
    returns: z.void(),
  },
}
