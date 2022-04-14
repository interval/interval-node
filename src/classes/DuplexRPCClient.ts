import { z } from 'zod'
import type { DuplexMessage } from '../internalRpcSchema'
import { DUPLEX_MESSAGE_SCHEMA } from '../internalRpcSchema'
import ISocket from './ISocket'

let count = 0
function generateId() {
  count = count + 1
  return count.toString()
}

interface MethodDef {
  [key: string]: {
    inputs: z.ZodFirstPartySchemaTypes | z.ZodDiscriminatedUnion<any, any, any>
    returns: z.ZodFirstPartySchemaTypes | z.ZodDiscriminatedUnion<any, any, any>
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

/**
 * Responsible for making RPC calls to another DuplexRPCClient.
 * Can send messages from CallerSchema and respond to messages
 * from ResponderSchema.
 *
 * @property communicator - The ISocket instance responsible for
 * sending the RPC messages.
 * @property handlers - Defines the actions taken when receiving
 * a given message, an object keyed by the message schema key.
 */
export class DuplexRPCClient<
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
  pendingCalls = new Map<string, OnReplyFn>()

  constructor({
    communicator,
    canCall,
    canRespondTo,
    handlers,
  }: CreateDuplexRPCClientProps<CallerSchema, ResponderSchema>) {
    this.communicator = communicator
    this.communicator.onMessage.attach(this.onmessage.bind(this))
    this.canCall = canCall
    this.canRespondTo = canRespondTo
    this.handlers = handlers
  }

  public setCommunicator(newCommunicator: ISocket): void {
    this.communicator.onMessage.detach()
    this.communicator = newCommunicator
    this.communicator.onMessage.attach(this.onmessage.bind(this))
  }

  private handleReceivedResponse(parsed: DuplexMessage) {
    const onReplyFn = this.pendingCalls.get(parsed.id)
    if (!onReplyFn) return

    onReplyFn(parsed.data)
    this.pendingCalls.delete(parsed.id)
  }

  private async handleReceivedCall(parsed: DuplexMessage) {
    type MethodKeys = keyof typeof this.canRespondTo

    const methodName = parsed.methodName as MethodKeys
    const method: ResponderSchema[MethodKeys] | undefined =
      this.canRespondTo[methodName]

    if (!method) {
      throw new Error(`There is no method for ${parsed.methodName}`)
    }

    // struggling to get real inference here
    const inputs = method.inputs.parse(parsed.data)
    const handler = this.handlers[methodName]

    const returnValue = await handler(inputs)

    const preparedResponseText = packageResponse({
      id: parsed.id,
      methodName: methodName as string, //??
      data: returnValue,
    })

    try {
      await this.communicator.send(preparedResponseText)
    } catch (err) {
      console.error('Failed sending response', preparedResponseText, err)
    }

    return
  }

  private onmessage(data: unknown) {
    const txt = data as string
    const inputParsed = DUPLEX_MESSAGE_SCHEMA.parse(JSON.parse(txt))

    if (inputParsed.kind === 'RESPONSE') {
      return this.handleReceivedResponse(inputParsed)
    }

    if (inputParsed.kind === 'CALL') {
      return this.handleReceivedCall(inputParsed)
    }
  }

  public send<MethodName extends keyof CallerSchema>(
    methodName: MethodName,
    inputs: z.infer<CallerSchema[MethodName]['inputs']>
  ) {
    const id = generateId()

    const msg = packageCall({
      id,
      data: inputs,
      methodName: methodName as string, // ??
    })

    type ReturnType = z.infer<CallerSchema[MethodName]['returns']>

    return new Promise<ReturnType>((resolve, reject) => {
      this.pendingCalls.set(id, (rawResponseText: string) => {
        const parsed =
          this.canCall[methodName]['returns'].parse(rawResponseText)
        return resolve(parsed)
      })

      this.communicator.send(msg).catch(err => {
        reject(err)
      })
    })
  }
}
