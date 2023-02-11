import { z } from 'zod'
import {
  deserializableRecord,
  legacyLinkSchema,
  linkSchema,
  serializableRecord,
} from './ioSchema'

export const DUPLEX_MESSAGE_SCHEMA = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('CALL'),
    methodName: z.string(),
    data: z.any(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('RESPONSE'),
    methodName: z.string(),
    data: z.any(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('CALL_CHUNK'),
    chunk: z.number(),
    totalChunks: z.number(),
    data: z.string(),
  }),
])

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

export type SdkAlert = z.infer<typeof SDK_ALERT>

export type LoadingOptions = z.input<typeof LOADING_OPTIONS>
export type LoadingState = z.input<typeof LOADING_STATE>

export const ACCESS_CONTROL_DEFINITION = z.union([
  z.literal('entire-organization'),
  z.object({
    teams: z.array(z.string()).optional(),
  }),
])

export type AccessControlDefinition = z.infer<typeof ACCESS_CONTROL_DEFINITION>

export const ACTION_DEFINITION = z.object({
  groupSlug: z.string().optional(),
  slug: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  backgroundable: z.boolean().optional(),
  unlisted: z.boolean().optional(),
  access: ACCESS_CONTROL_DEFINITION.optional(),
})

export type ActionDefinition = z.infer<typeof ACTION_DEFINITION>

export const PAGE_DEFINITION = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  hasHandler: z.boolean().optional(),
  // Older version of hasHandler, deprecated
  hasIndex: z.boolean().optional(),
  unlisted: z.boolean().optional(),
  access: ACCESS_CONTROL_DEFINITION.optional(),
})

export type PageDefinition = z.infer<typeof PAGE_DEFINITION>

export const ICE_SERVER = z.object({
  url: z.string(),
  urls: z.string(),
  hostname: z.string(),
  port: z.number(),
  relayType: z.enum(['TurnUdp', 'TurnTcp', 'TurnTls']).optional(),
  username: z.string().optional(),
  credential: z.string().optional(),
  password: z.string().optional(),
})

export type IceServer = z.infer<typeof ICE_SERVER>

export const ICE_CONFIG = z.object({
  iceServers: z.array(ICE_SERVER),
})

export type IceConfig = z.infer<typeof ICE_CONFIG>

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

export const DECLARE_HOST = {
  inputs: z.object({
    httpHostId: z.string(),
    actions: z.array(ACTION_DEFINITION),
    groups: z.array(PAGE_DEFINITION).optional(),
    sdkName: z.string(),
    sdkVersion: z.string(),
  }),
  returns: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('success'),
      invalidSlugs: z.array(z.string()),
      sdkAlert: SDK_ALERT.nullish(),
      warnings: z.array(z.string()),
    }),
    z.object({
      type: z.literal('error'),
      message: z.string(),
      sdkAlert: SDK_ALERT.nullish(),
    }),
  ]),
}

const PEER_CANDIDATE = z.object({
  type: z.literal('candidate'),
  id: z.string(),
  candidate: z.string(),
  mid: z.string(),
})

export type PeerCandidate = z.infer<typeof PEER_CANDIDATE>

const INITIALIZE_PEER_CONNECTION = {
  inputs: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('offer'),
      id: z.string(),
      description: z.string(),
    }),
    z.object({
      type: z.literal('answer'),
      id: z.string(),
      description: z.string(),
    }),
    PEER_CANDIDATE,
    z.object({
      type: z.literal('unspec'),
      id: z.string(),
    }),
    z.object({
      type: z.literal('pranswer'),
      id: z.string(),
    }),
    z.object({
      type: z.literal('rollback'),
      id: z.string(),
    }),
  ]),
  returns: z.void(),
}

export const wsServerSchema = {
  CONNECT_TO_TRANSACTION_AS_CLIENT: {
    inputs: z.object({
      transactionId: z.string(),
      params: serializableRecord.optional(),
    }),
    returns: z.boolean(),
  },
  LEAVE_TRANSACTION: {
    inputs: z.object({
      transactionId: z.string(),
    }),
    returns: z.boolean(),
  },
  REQUEST_PAGE: {
    inputs: z.object({
      pageKey: z.string().optional(),
      pageSlug: z.string(),
      actionEnvironment,
      organizationEnvironmentId: z.string(),
      params: serializableRecord.optional(),
    }),
    returns: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('SUCCESS'),
        pageKey: z.string(),
      }),
      z.object({
        type: z.literal('ERROR'),
        message: z.string().optional(),
      }),
    ]),
  },
  LEAVE_PAGE: {
    inputs: z.object({
      pageKey: z.string(),
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
      skipClientCall: z.boolean().optional(),
    }),
    returns: z.boolean(),
  },
  SEND_PAGE: {
    inputs: z.object({
      pageKey: z.string(),
      // stringified PAGE_SCHEMA
      page: z.string(),
    }),
    returns: z.boolean(),
  },
  SEND_LOADING_CALL: {
    inputs: z.intersection(
      LOADING_STATE,
      z.object({
        transactionId: z.string(),
        label: z.string().optional(),
        skipClientCall: z.boolean().optional(),
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
      skipClientCall: z.boolean().optional(),
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
  SEND_REDIRECT: {
    inputs: z.intersection(
      z.object({
        transactionId: z.string(),
        skipClientCall: z.boolean().optional(),
      }),
      legacyLinkSchema
    ),
    returns: z.boolean(),
  },
  MARK_TRANSACTION_COMPLETE: {
    inputs: z.object({
      transactionId: z.string(),
      resultStatus: z
        .enum(['SUCCESS', 'FAILURE', 'CANCELED', 'REDIRECTED'])
        .optional(),
      result: z.string().optional(),
      skipClientCall: z.boolean().optional(),
    }),
    returns: z.boolean(),
  },
  INITIALIZE_CLIENT: {
    inputs: z.undefined(),
    returns: z.boolean(),
  },
  INITIALIZE_PEER_CONNECTION,
  INITIALIZE_HOST: {
    inputs: z.intersection(
      z.object({
        sdkName: z.string().optional(),
        sdkVersion: z.string().optional(),
        requestId: z.string().optional(),
      }),
      z.union([
        z.object({
          // Actually slugs, for backward compatibility
          // TODO: Change to slug in breaking release
          callableActionNames: z.array(z.string()),
        }),
        z.object({
          actions: z.array(ACTION_DEFINITION),
          groups: z.array(PAGE_DEFINITION).optional(),
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
          forcePeerMessages: z.boolean().optional(),
          sdkAlert: SDK_ALERT.nullish(),
          warnings: z.array(z.string()),
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
    inputs: z.object({
      transactionId: z.string(),
    }),
    returns: z.void().nullable(),
  },
  TRANSACTION_COMPLETED: {
    inputs: z.object({
      transactionId: z.string(),
      resultStatus: z.enum(['SUCCESS', 'FAILURE', 'CANCELED', 'REDIRECTED']),
      result: z.string().optional(),
    }),
    returns: z.void().nullable(),
  },
  HOST_CLOSED_UNEXPECTEDLY: {
    inputs: z.object({
      transactionId: z.string(),
    }),
    returns: z.void().nullable(),
  },
  HOST_RECONNECTED: {
    inputs: z.object({
      transactionId: z.string(),
    }),
    returns: z.void().nullable(),
  },
  RENDER_PAGE: {
    inputs: z.object({
      pageKey: z.string(),
      // stringified PAGE_SCHEMA
      page: z.string(),
      hostInstanceId: z.string(),
    }),
    returns: z.boolean(),
  },
  RENDER: {
    inputs: z.object({
      transactionId: z.string(),
      toRender: z.string(),
    }),
    returns: z.boolean(),
  },
  LOADING_STATE: {
    inputs: z
      .object({
        transactionId: z.string(),
      })
      .merge(LOADING_STATE),
    returns: z.boolean(),
  },
  LOG: {
    inputs: z.object({
      transactionId: z.string(),
      data: z.string().nullable(),
      index: z.number(),
      timestamp: z.number(),
    }),
    returns: z.boolean(),
  },
  NOTIFY: {
    inputs: z.object({
      transactionId: z.string(),
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
  REDIRECT: {
    inputs: z.intersection(
      z.object({
        transactionId: z.string(),
      }),
      linkSchema
    ),
    returns: z.boolean(),
  },
  INITIALIZE_PEER_CONNECTION,
}

export type ClientSchema = typeof clientSchema

export const hostSchema = {
  OPEN_PAGE: {
    inputs: z.object({
      pageKey: z.string(),
      clientId: z.string().optional(),
      page: z.object({
        slug: z.string(),
      }),
      environment: actionEnvironment,
      user: z.object({
        email: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
      }),
      params: serializableRecord,
      paramsMeta: z.any().optional(),
    }),
    returns: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('SUCCESS'),
        pageKey: z.string(),
      }),
      z.object({
        type: z.literal('ERROR'),
        message: z.string().optional(),
      }),
    ]),
  },
  CLOSE_PAGE: {
    inputs: z.object({
      pageKey: z.string(),
    }),
    returns: z.void().nullable(),
  },
  START_TRANSACTION: {
    inputs: z.object({
      transactionId: z.string(),
      clientId: z.string().optional(),

      postponeCompleteCleanup: z.boolean().optional(),

      // Actually slug, for backward compatibility
      // TODO: Remove breaking release, superfluous with slug below
      actionName: z.string(),
      action: z.object({
        slug: z.string(),
        url: z.string(),
      }),
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
  CLOSE_TRANSACTION: {
    inputs: z.object({
      transactionId: z.string(),
    }),
    returns: z.void().nullable(),
  },
  IO_RESPONSE: {
    inputs: z.object({
      value: z.string(),
      transactionId: z.string(),
    }),
    returns: z.void().nullable(),
  },
  INITIALIZE_PEER_CONNECTION,
}

export type HostSchema = typeof hostSchema

export type PeerConnectionInitializer = (
  inputs: z.infer<typeof INITIALIZE_PEER_CONNECTION['inputs']>
) => Promise<z.infer<typeof INITIALIZE_PEER_CONNECTION['returns']>>
