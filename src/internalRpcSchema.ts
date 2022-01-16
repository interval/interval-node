import { z } from 'zod'

export const wsServerSchema = {
  CONNECT_TO_TRANSACTION_AS_CLIENT: {
    inputs: z.object({
      transactionId: z.string(),
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
    }),
    returns: z.boolean(),
  },
  INITIALIZE_HOST: {
    inputs: z.object({
      apiKey: z.string(),
      callableActionNames: z.array(z.string()),
    }),
    returns: z.union([
      z.null(),
      z.object({
        dashboardUrl: z.string(),
      }),
    ]),
  },
}

export const clientSchema = {
  CLIENT_USURPED: {
    inputs: z.undefined(),
    returns: z.void(),
  },
  MARK_TRANSACTION_COMPLETE: {
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
      actionName: z.string(),
    }),
    returns: z.void(),
  },
}
