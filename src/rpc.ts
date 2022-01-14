import { z } from "zod";

export const MESSAGE_META = z.object({
  id: z.string(),
  methodName: z.string(),
  kind: z.enum(["CALL", "RESPONSE"]),
});

let count = 0;
function generateId() {
  count = count + 1;
  return count + "";
}

interface MethodDef {
  [key: string]: {
    inputs: z.ZodFirstPartySchemaTypes;
    returns: z.ZodFirstPartySchemaTypes;
  };
}

type OnReplyFn = (anyObject: any) => void;

type SendFn = (rawInput: string) => void;

const completeMessageSchema = z.intersection(
  MESSAGE_META,
  z.object({ response: z.any() })
);

export function createCaller<Methods extends MethodDef>({
  schema,
  send,
}: {
  schema: { methods: Methods };
  send: SendFn;
}) {
  const pending = new Map<string, OnReplyFn>();

  const { methods } = schema;

  return {
    replyHandler(rawReply: string) {
      const parsed = completeMessageSchema.parse(JSON.parse(rawReply));
      if (parsed.kind !== "RESPONSE") return;
      const onReplyFn = pending.get(parsed.id);
      if (!onReplyFn) return;

      onReplyFn(parsed.response);
      pending.delete(parsed.id);
    },
    client<MethodName extends keyof Methods>(
      methodName: MethodName,
      inputs: z.infer<typeof methods[MethodName]["inputs"]>
    ) {
      const id = generateId();

      const msg = JSON.stringify({
        id,
        kind: "CALL",
        inputs,
        methodName: methodName,
      });

      type ReturnType = z.infer<typeof methods[MethodName]["returns"]>;

      return new Promise<ReturnType>((resolve) => {
        pending.set(id, (anyObject: string) => {
          const parsed = methods[methodName]["returns"].parse(anyObject);
          return resolve(parsed);
        });
        send(msg);
      });
    },
  };
}

export function createResponder<Methods extends MethodDef>({
  methods,
  handlers,
}: {
  methods: Methods;
  handlers: {
    [Property in keyof Methods]: (
      inputs: z.infer<Methods[Property]["inputs"]>
    ) => Promise<z.infer<Methods[Property]["returns"]>>;
  };
}) {
  return async function respond(rawInput: string) {
    const completeMessageSchema = z.intersection(
      MESSAGE_META,
      z.object({ inputs: z.any() })
    );

    const inputParsed = completeMessageSchema.parse(JSON.parse(rawInput));

    type MethodKeys = keyof typeof methods;

    const methodName = inputParsed.methodName as MethodKeys;
    const method: typeof methods[MethodKeys] | undefined = methods[methodName];

    if (!method) {
      throw new Error(`There is no method for ${inputParsed.methodName}`);
    }

    // struggling to get real inference here
    const inputs = method.inputs.parse(inputParsed.inputs);
    const handler = handlers[methodName];

    const output = await handler(inputs);

    return JSON.stringify({
      id: inputParsed.id,
      kind: "RESPONSE",
      methodName,
      response: output,
    });
  };
}
