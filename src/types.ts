import type { z } from 'zod'
import type {
  T_IO_RENDER_INPUT,
  T_IO_RESPONSE,
  T_IO_PROPS,
  T_IO_RETURNS,
  T_IO_STATE,
  T_IO_Schema,
  T_IO_METHOD_NAMES,
  IOFunctionReturnType,
} from './ioSchema'
import type { HostSchema } from './internalRpcSchema'
import type { IOClient } from './classes/IOClient'
import type IOComponent from './classes/IOComponent'
import type { ComponentReturnValue } from './classes/IOComponent'
import type {
  IOPromise,
  OptionalIOPromise,
  ExclusiveIOPromise,
} from './classes/IOPromise'
import type IOError from './classes/IOError'

export type ActionCtx = Pick<
  z.infer<HostSchema['START_TRANSACTION']['inputs']>,
  'user' | 'params' | 'environment'
> & {
  log: ActionLogFn
}

export type ActionLogFn = (...args: any[]) => void

export type IO = IOClient['io']

export type IntervalActionHandler = (
  io: IO,
  ctx: ActionCtx
) => Promise<IOFunctionReturnType | void>

export interface ExplicitIntervalActionDefinition {
  handler: IntervalActionHandler
  backgroundable?: boolean
}

export type IntervalActionDefinition =
  | IntervalActionHandler
  | ExplicitIntervalActionDefinition

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
  [MethodName in T_IO_METHOD_NAMES]: IOPromise<
    MethodName,
    T_IO_PROPS<MethodName>,
    any
  >
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
    : IOPromise<MethodName, T_IO_PROPS<MethodName>, any>
}
export type GroupIOPromise = GroupIOPromiseMap[T_IO_METHOD_NAMES]

export type OptionalGroupIOPromiseMap = {
  [MethodName in T_IO_METHOD_NAMES]: T_IO_Schema[MethodName] extends {
    exclusive: z.ZodLiteral<true>
  }
    ? never
    : OptionalIOPromise<MethodName, T_IO_PROPS<MethodName>, any>
}
export type OptionalGroupIOPromise =
  OptionalGroupIOPromiseMap[T_IO_METHOD_NAMES]

export type MaybeOptionalGroupIOPromise =
  | GroupIOPromise
  | OptionalGroupIOPromise

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
