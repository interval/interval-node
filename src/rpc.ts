import { z } from 'zod'
import type { DuplexMessage } from './internalRpcSchema'
import { DUPLEX_MESSAGE_SCHEMA } from './internalRpcSchema'
import ISocket from './ISocket'

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

function packageResponse({
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

export type DuplexRPCClient<CallerSchema extends MethodDef> = {
  setCommunicator: (newCommunicator: ISocket) => void
  send: <MethodName extends keyof CallerSchema>(
    methodName: MethodName,
    inputs: z.infer<CallerSchema[MethodName]['inputs']>
  ) => Promise<z.infer<CallerSchema[MethodName]['returns']>>
}

interface CreateDuplexRPCClientProps<
  CallerSchema extends MethodDef,
  ResponderSchema extends MethodDef
> {
  communicator: ISocket
  canCall: CallerSchema
  canRespondTo: ResponderSchema
  handlers: {
    [Property in keyof ResponderSchema]: (
      inputs: z.infer<ResponderSchema[Property]['inputs']>
    ) => Promise<z.infer<ResponderSchema[Property]['returns']>>
  }
}

export function createDuplexRPCClient<
  CallerSchema extends MethodDef,
  ResponderSchema extends MethodDef
>(
  props: CreateDuplexRPCClientProps<CallerSchema, ResponderSchema>
): DuplexRPCClient<CallerSchema> {
  const { canCall, canRespondTo, handlers } = props

  const pendingCalls = new Map<string, OnReplyFn>()
  let communicator = props.communicator

  function setCommunicator(newCommunicator: ISocket) {
    communicator = newCommunicator
    communicator.onMessage.attach(onmessage)
  }

  setCommunicator(communicator)

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

  function onmessage(data: unknown) {
    const txt = data as string
    const inputParsed = DUPLEX_MESSAGE_SCHEMA.parse(JSON.parse(txt))

    if (inputParsed.kind === 'RESPONSE') {
      return handleReceivedResponse(inputParsed)
    }

    if (inputParsed.kind === 'CALL') {
      return handleReceivedCall(inputParsed)
    }
  }

  function send<MethodName extends keyof CallerSchema>(
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
      // tbd but I think you should await this
      communicator.send(msg)
    })
  }

  return { send, setCommunicator }
}
