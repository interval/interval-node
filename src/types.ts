import type { z } from 'zod'
import type {
  T_IO_RENDER_INPUT,
  T_IO_RESPONSE,
  T_IO_PROPS,
  T_IO_RETURNS,
  T_IO_STATE,
  T_IO_Schema,
  T_IO_METHOD_NAMES,
} from './ioSchema'
import type IOComponent from './component'
import type { ComponentReturnValue } from './component'
import type {
  IOPromise,
  OptionalIOPromise,
  ExclusiveIOPromise,
} from './IOPromise'

export type IOPromiseConstructor<
  MethodName extends T_IO_METHOD_NAMES,
  Output = ComponentReturnValue<MethodName>
> = (c: IOComponent<MethodName>) => IOPromise<MethodName, Output>

export type IOComponentFunction<
  MethodName extends T_IO_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: Props
) => IOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type ExclusiveIOComponentFunction<
  MethodName extends T_IO_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: Props
) => ExclusiveIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type ComponentRenderer<MethodName extends T_IO_METHOD_NAMES> = (
  components: [IOComponent<MethodName>]
) => Promise<[ComponentReturnValue<MethodName>]>

export type IORenderSender = (ioToRender: T_IO_RENDER_INPUT) => Promise<void>

export type ResponseHandlerFn = (fn: T_IO_RESPONSE) => void

export type Executor<
  MethodName extends T_IO_METHOD_NAMES,
  Output = ComponentReturnValue<MethodName>
> = (resolve: (output: Output) => void, reject?: (err: IOError) => void) => void

export type OptionalExecutor<
  MethodName extends T_IO_METHOD_NAMES,
  Output = ComponentReturnValue<MethodName>
> = (
  resolve: (output: Output | undefined) => void,
  reject?: (err: IOError) => void
) => void

export type IOPromiseMap = {
  [MethodName in T_IO_METHOD_NAMES]: IOPromise<MethodName, any>
}
export type AnyIOPromise = IOPromiseMap[T_IO_METHOD_NAMES]

/**
 * Map of IOPromises that can be rendered in a group.
 */
export type GroupIOPromiseMap = {
  [MethodName in T_IO_METHOD_NAMES]: T_IO_Schema[MethodName] extends {
    exclusive: z.ZodLiteral<true>
  }
    ? never
    : IOPromise<MethodName, any>
}
export type GroupIOPromise = GroupIOPromiseMap[T_IO_METHOD_NAMES]

export type OptionalGroupIOPromiseMap = {
  [MethodName in T_IO_METHOD_NAMES]: T_IO_Schema[MethodName] extends {
    exclusive: z.ZodLiteral<true>
  }
    ? never
    : OptionalIOPromise<MethodName>
}
export type OptionalGroupIOPromise =
  OptionalGroupIOPromiseMap[T_IO_METHOD_NAMES]

export type MaybeOptionalGroupIOPromise =
  | GroupIOPromise
  | OptionalGroupIOPromise

export type IOErrorKind = 'CANCELED' | 'TRANSACTION_CLOSED'

export class IOError extends Error {
  kind: IOErrorKind

  constructor(kind: IOErrorKind, message?: string) {
    super(message)
    this.kind = kind
  }
}

export type IOComponentDefinition<
  MethodName extends T_IO_METHOD_NAMES,
  Props,
  Output
> = (props: Props) => {
  props?: T_IO_PROPS<MethodName>
  getValue?: (response: T_IO_RETURNS<MethodName>) => Output
  onStateChange?: (
    newState: T_IO_STATE<MethodName>
  ) => Promise<T_IO_PROPS<MethodName>>
}
