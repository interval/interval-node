import { z } from 'zod'
import { deserializableRecord, serializableRecord } from './ioSchema'

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

export const LOADING_OPTIONS = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  itemsInQueue: z.number().int().optional(),
})

const LOADING_STATE = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  itemsInQueue: z.number().int().optional(),
  itemsCompleted: z.number().int().optional(),
})

const SDK_ALERT = z.object({
  minSdkVersion: z.string(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR']),
  message: z.string().nullish(),
})

export type LoadingOptions = z.input<typeof LOADING_OPTIONS>
export type LoadingState = z.input<typeof LOADING_STATE>

export const ENQUEUE_ACTION = {
  inputs: z.object({
    slug: z.string(),
    assignee: z.string().nullish(),
    params: deserializableRecord.nullish(),
    paramsMeta: z.any().optional(),
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

export const CREATE_GHOST_MODE_ACCOUNT = {
  inputs: z.object({}),
  returns: z.object({
    ghostOrgId: z.string(),
  }),
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
      params: deserializableRecord.optional(),
      paramsMeta: z.any().optional(),
    }),
    z.object({
      type: z.literal('error'),
      message: z.string(),
    }),
  ]),
}

export const NOTIFY = {
  inputs: z.object({
    transactionId: z.string().optional(),
    message: z.string(),
    title: z.string().optional(),
    deliveryInstructions: z.array(
      z.object({
        to: z.string(),
        method: z.enum(['EMAIL', 'SLACK']).optional(),
      })
    ),
    createdAt: z.string(),
    idempotencyKey: z.string().optional(),
  }),
  returns: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('success'),
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
  SEND_LOADING_CALL: {
    inputs: z.intersection(
      LOADING_STATE,
      z.object({
        transactionId: z.string(),
        label: z.string().optional(),
      })
    ),
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
  NOTIFY: {
    inputs: z.object({
      transactionId: z.string(),
      message: z.string(),
      title: z.string().optional(),
      idempotencyKey: z.string().optional(),
      deliveryInstructions: z
        .array(
          z.object({
            to: z.string(),
            method: z.enum(['EMAIL', 'SLACK']).optional(),
          })
        )
        .optional(),
      createdAt: z.string(),
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
    inputs: z.intersection(
      z.object({
        apiKey: z.string().optional(),
        sdkName: z.string().optional(),
        sdkVersion: z.string().optional(),
      }),
      z.union([
        z.object({
          // Actually slugs, for backward compatibility
          // TODO: Change to slug in breaking release
          callableActionNames: z.array(z.string()),
        }),
        z.object({
          actions: z.array(
            z.object({
              slug: z.string(),
              backgroundable: z.boolean().optional(),
            })
          ),
        }),
      ])
    ),
    returns: z
      .discriminatedUnion('type', [
        z.object({
          type: z.literal('success'),
          environment: actionEnvironment,
          invalidSlugs: z.array(z.string()),
          organization: z.object({
            name: z.string(),
            slug: z.string(),
          }),
          dashboardUrl: z.string(),
          sdkAlert: SDK_ALERT.nullish(),
        }),
        z.object({
          type: z.literal('error'),
          message: z.string(),
          sdkAlert: SDK_ALERT.nullish(),
        }),
      ])
      .nullable(),
  },
}

export type WSServerSchema = typeof wsServerSchema

export const clientSchema = {
  CLIENT_USURPED: {
    inputs: z.undefined(),
    returns: z.void().nullable(),
  },
  TRANSACTION_COMPLETED: {
    inputs: z.object({
      resultStatus: z.enum(['SUCCESS', 'FAILURE', 'CANCELED']),
    }),
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
  LOADING_STATE: {
    inputs: LOADING_STATE,
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
  NOTIFY: {
    inputs: z.object({
      deliveries: z.array(
        z.object({
          to: z.string(),
          method: z.enum(['EMAIL', 'SLACK']).optional(),
        })
      ),
      message: z.string(),
      title: z.string().optional(),
      idempotencyKey: z.string().optional(),
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
      paramsMeta: z.any().optional(),
    }),
    returns: z.void().nullable(),
  },
}

export type HostSchema = typeof hostSchema
