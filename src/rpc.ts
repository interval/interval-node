import { z } from 'zod'

let count = 0
function generateId() {
  count = count + 1
  return count + ''
}

interface MethodDef {
  [key: string]: {
    inputs: z.ZodFirstPartySchemaTypes
    returns: z.ZodFirstPartySchemaTypes
  }
}

type OnReplyFn = (anyObject: any) => void

interface Communicator {
  on: (kind: string, handler: (...args: unknown[]) => void) => void
  send: (data: string) => Promise<any>
}

export const DUPLEX_MESSAGE_SCHEMA = z.object({
  id: z.string(),
  methodName: z.string(),
  data: z.any(),
  kind: z.enum(['CALL', 'RESPONSE']),
})

type DuplexMessage = z.infer<typeof DUPLEX_MESSAGE_SCHEMA>

export function packageResponse({
  id,
  methodName,
  data,
}: Omit<DuplexMessage, 'kind'>) {
  const preparedResponseText: DuplexMessage = {
    id: id,
    kind: 'RESPONSE',
    methodName: methodName,
    data,
  }
  return JSON.stringify(preparedResponseText)
}

function packageCall({ id, methodName, data }: Omit<DuplexMessage, 'kind'>) {
  const callerData: DuplexMessage = {
    id,
    kind: 'CALL',
    data,
    methodName: methodName as string, // ??
  }

  return JSON.stringify(callerData)
}

type SendFn = (rawInput: string) => void

export function createCaller<Methods extends MethodDef>({
  schema,
  send,
}: {
  schema: Methods
  send: SendFn
}) {
  const pending = new Map<string, OnReplyFn>()

  return {
    replyHandler(rawReply: string) {
      const parsed = DUPLEX_MESSAGE_SCHEMA.parse(JSON.parse(rawReply))
      if (parsed.kind !== 'RESPONSE') return
      const onReplyFn = pending.get(parsed.id)
      if (!onReplyFn) return

      onReplyFn(parsed.data)
      pending.delete(parsed.id)
    },
    client<MethodName extends keyof Methods>(
      methodName: MethodName,
      inputs: z.infer<typeof schema[MethodName]['inputs']>
    ) {
      const id = generateId()

      const msg = packageCall({
        id,
        data: inputs,
        methodName: methodName as string,
      })

      type ReturnType = z.infer<typeof schema[MethodName]['returns']>

      return new Promise<ReturnType>(resolve => {
        pending.set(id, (anyObject: string) => {
          const parsed = schema[methodName]['returns'].parse(anyObject)
          return resolve(parsed)
        })
        send(msg)
      })
    },
  }
}

export function createDuplexRPCClient<
  CallerSchema extends MethodDef,
  ResponderSchema extends MethodDef
>({
  communicator,
  canCall,
  canRespondTo,
  handlers,
}: {
  communicator: Communicator
  canCall: CallerSchema
  canRespondTo: ResponderSchema
  handlers: {
    [Property in keyof ResponderSchema]: (
      inputs: z.infer<ResponderSchema[Property]['inputs']>
    ) => Promise<z.infer<ResponderSchema[Property]['returns']>>
  }
}) {
  const pendingCalls = new Map<string, OnReplyFn>()

  function handleReceivedResponse(parsed: DuplexMessage) {
    const onReplyFn = pendingCalls.get(parsed.id)
    if (!onReplyFn) return

    onReplyFn(parsed.data)
    pendingCalls.delete(parsed.id)
  }

  async function handleReceivedCall(parsed: DuplexMessage) {
    type MethodKeys = keyof typeof canRespondTo

    const methodName = parsed.methodName as MethodKeys
    const method: typeof canRespondTo[MethodKeys] | undefined =
      canRespondTo[methodName]

    if (!method) {
      throw new Error(`There is no method for ${parsed.methodName}`)
    }

    // struggling to get real inference here
    const inputs = method.inputs.parse(parsed.data)
    const handler = handlers[methodName]

    const returnValue = await handler(inputs)

    const preparedResponseText = packageResponse({
      id: parsed.id,
      methodName: methodName as string, //??
      data: returnValue,
    })

    await communicator.send(preparedResponseText)

    return
  }

  communicator.on('message', data => {
    const txt = data as string
    const inputParsed = DUPLEX_MESSAGE_SCHEMA.parse(JSON.parse(txt))

    if (inputParsed.kind === 'RESPONSE') {
      return handleReceivedResponse(inputParsed)
    }

    if (inputParsed.kind === 'CALL') {
      return handleReceivedCall(inputParsed)
    }
  })

  return function client<MethodName extends keyof CallerSchema>(
    methodName: MethodName,
    inputs: z.infer<typeof canCall[MethodName]['inputs']>
  ) {
    const id = generateId()

    const msg = packageCall({
      id,
      data: inputs,
      methodName: methodName as string, // ??
    })

    type ReturnType = z.infer<typeof canCall[MethodName]['returns']>

    return new Promise<ReturnType>(resolve => {
      pendingCalls.set(id, (rawResponseText: string) => {
        const parsed = canCall[methodName]['returns'].parse(rawResponseText)
        return resolve(parsed)
      })
      communicator.send(msg)
    })
  }
}
