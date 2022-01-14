import { z } from "zod";

export const internalRpcSchema = {
  methods: {
    INITIALIZE_HOST: {
      inputs: z.object({
        apiKey: z.string(),
        callableActionNames: z.array(z.string()),
      }),
      returns: z.boolean(),
    },
    TAKEOVER_TRANSACTION: {
      inputs: z.object({
        transactionId: z.string(),
      }),
      returns: z.boolean(),
    },
  },
};
