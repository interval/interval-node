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
  T_IO_DISPLAY_METHOD_NAMES,
  T_IO_INPUT_METHOD_NAMES,
  LinkProps,
  menuItem,
  ButtonTheme,
  serializableRecord,
  ImageSize,
} from './ioSchema'
import type { HostSchema } from './internalRpcSchema'
import type { IOClient, IOClientRenderValidator } from './classes/IOClient'
import type IOComponent from './classes/IOComponent'
import type {
  AnyIOComponent,
  ComponentReturnValue,
} from './classes/IOComponent'
import type {
  IOPromise,
  OptionalIOPromise,
  ExclusiveIOPromise,
  DisplayIOPromise,
  InputIOPromise,
} from './classes/IOPromise'
import type IOError from './classes/IOError'
import type TransactionLoadingState from './classes/TransactionLoadingState'
import type { ActionGroup } from './experimental'

export type ActionCtx = Pick<
  z.infer<HostSchema['START_TRANSACTION']['inputs']>,
  'user' | 'params' | 'environment'
> & {
  loading: TransactionLoadingState
  log: ActionLogFn
  notify: NotifyFn
  redirect: RedirectFn
  organization: {
    name: string
    slug: string
  }
  action: {
    slug: string
    url: string
  }
}

export type PageCtx = Pick<
  ActionCtx,
  'user' | 'params' | 'environment' | 'organization'
> & {
  page: {
    slug: string
  }
}

export type IO = IOClient['io']

export type IntervalActionHandler = (
  io: IO,
  ctx: ActionCtx
) => Promise<IOFunctionReturnType | void>

export interface IntervalActionStore {
  io: IO
  ctx: ActionCtx
}

export interface IntervalPageStore {
  display: IO['display']
  ctx: PageCtx
}

export interface ExplicitIntervalActionDefinition {
  prefix?: string
  handler: IntervalActionHandler
  backgroundable?: boolean
  name?: string
  description?: string
}

export type IntervalActionDefinition =
  | IntervalActionHandler
  | ExplicitIntervalActionDefinition

export type IntervalActionDefinitions = Record<
  string,
  IntervalActionDefinition | ActionGroup
>

export type RequiredPropsIOComponentFunction<
  MethodName extends T_IO_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props: Props
) => IOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type RequiredPropsExclusiveIOComponentFunction<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props: Props
) => ExclusiveIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type IOComponentFunction<
  MethodName extends T_IO_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: Props
) => IOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type InputIOComponentFunction<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: Props
) => InputIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type RequiredPropsInputIOComponentFunction<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props: Props
) => InputIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type DisplayIOComponentFunction<
  MethodName extends T_IO_DISPLAY_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: Props
) => DisplayIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type RequiredPropsDisplayIOComponentFunction<
  MethodName extends T_IO_DISPLAY_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props: Props
) => DisplayIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type ExclusiveIOComponentFunction<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: Props
) => ExclusiveIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type ComponentRenderer<MethodName extends T_IO_METHOD_NAMES> = (
  components: [IOComponent<MethodName>, ...IOComponent<MethodName>[]]
) => Promise<
  [ComponentReturnValue<MethodName>, ...ComponentReturnValue<MethodName>[]]
>

export type ComponentsRenderer<
  Components extends [AnyIOComponent, ...AnyIOComponent[]] = [
    AnyIOComponent,
    ...AnyIOComponent[]
  ]
> = (
  components: Components,
  validator?: IOClientRenderValidator<Components>,
  continueButton?: ButtonConfig
) => Promise<{
  [Idx in keyof Components]: Components[Idx] extends AnyIOComponent
    ? z.infer<Components[Idx]['schema']['returns']> | undefined
    : Components[Idx]
}>

export type IORenderSender = (ioToRender: T_IO_RENDER_INPUT) => Promise<void>

export interface NotificationDeliveryInstruction {
  to: string
  method?: 'SLACK' | 'EMAIL'
}

export type NotifyConfig = {
  message: string
  title?: string
  delivery?: NotificationDeliveryInstruction[]
  transactionId?: string
  idempotencyKey?: string
}

export type ActionLogFn = (...args: any[]) => Promise<void>

export type NotifyFn = (config: NotifyConfig) => Promise<void>

export type RedirectFn = (props: LinkProps) => Promise<void>

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

export type DisplayIOPromiseMap = {
  [MethodName in T_IO_DISPLAY_METHOD_NAMES]: DisplayIOPromise<
    MethodName,
    T_IO_PROPS<MethodName>,
    any
  >
}
export type AnyDisplayIOPromise = DisplayIOPromiseMap[T_IO_DISPLAY_METHOD_NAMES]

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
  [MethodName in T_IO_INPUT_METHOD_NAMES]: T_IO_Schema[MethodName] extends {
    exclusive: z.ZodLiteral<true>
  }
    ? never
    : OptionalIOPromise<MethodName, T_IO_PROPS<MethodName>, any>
}
export type OptionalGroupIOPromise =
  OptionalGroupIOPromiseMap[T_IO_INPUT_METHOD_NAMES]

export type MaybeOptionalGroupIOPromise =
  | GroupIOPromise
  | OptionalGroupIOPromise

export type IOComponentDefinition<
  MethodName extends T_IO_METHOD_NAMES,
  Props,
  Output
> = (
  this: IOClient,
  props: Props
) => {
  props?: T_IO_PROPS<MethodName>
  getValue?: (response: T_IO_RETURNS<MethodName>) => Output
  onStateChange?: (
    newState: T_IO_STATE<MethodName>
  ) => Promise<T_IO_PROPS<MethodName>>
}

export type InternalMenuItem = z.input<typeof menuItem>
export type MenuItem = InternalMenuItem
// | {
//     label: InternalMenuItem['label']
//     theme?: InternalMenuItem['theme']
//     action: IntervalActionHandler
//     disabled?: boolean
//   }

export type ButtonConfig = {
  label?: string
  theme?: ButtonTheme
}

export type GroupConfig = {
  continueButton: ButtonConfig
}

export type TableCellValue = string | number | boolean | null | Date | undefined

export type TableColumnResult =
  | {
      label?: TableCellValue
      value?: TableCellValue
      image?: {
        alt?: string
        size?: ImageSize
        width?: ImageSize
        height?: ImageSize
      } & ({ url: string } | { buffer: Buffer })
      url?: string
      action?: string
      params?: z.infer<typeof serializableRecord>
    }
  | TableCellValue

export interface TableColumn<Row> {
  label: string
  renderCell: (row: Row) => TableColumnResult
}
