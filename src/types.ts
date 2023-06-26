import type { z } from 'zod'
import type { Evt } from 'evt'
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
  buttonItem,
  ButtonTheme,
  serializableRecord,
  ImageSize,
  SerializableRecord,
  LegacyLinkProps,
  T_IO_MULTIPLEABLE_METHOD_NAMES,
  HighlightColor,
} from './ioSchema'
import type {
  AccessControlDefinition,
  ActionEnvironment,
  HostSchema,
} from './internalRpcSchema'
import type { IOClient, IOClientRenderValidator } from './classes/IOClient'
import type IOComponent from './classes/IOComponent'
import type {
  AnyIOComponent,
  ComponentReturnValue,
  MaybeMultipleComponentReturnValue,
} from './classes/IOComponent'
import type {
  IOPromise,
  OptionalIOPromise,
  ExclusiveIOPromise,
  DisplayIOPromise,
  InputIOPromise,
  MultipleableIOPromise,
} from './classes/IOPromise'
import type IOError from './classes/IOError'
import type TransactionLoadingState from './classes/TransactionLoadingState'
import type { Layout } from './classes/Layout'
import type Page from './classes/Page'
import type { BasicLayoutConfig } from './classes/Layout'
import type Action from './classes/Action'

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type CtxUser = {
  /**
   * The email of the user running the action or page.
   */
  email: string
  /**
   * The first name of the user running the action or page, if present.
   */
  firstName: string | null
  /**
   * The last name of the user running the action or page, if present.
   */
  lastName: string | null
}

export type CtxOrganization = {
  /**
   * The name of the organization.
   */
  name: string
  /**
   * The unique slug of the organization.
   */
  slug: string
}

export type ActionCtx = {
  /**
   * Basic information about the user running the action or page.
   */
  user: CtxUser
  /**
   * A key/value object containing the query string URL parameters of the running action or page.
   */
  params: SerializableRecord
  /**
   * The environment the action or page is running within.
   */
  environment: ActionEnvironment
  /**
   * Methods to display loading indicators to the user.
   */
  loading: TransactionLoadingState
  /**
   * Logs anything from your action by printing a message in the Interval dashboard. Works with multiple arguments like JavaScript’s console.log. Logs are truncated at 10,000 characters.
   *
   * **Usage:**
   *
   * ```typescript
   * await ctx.log("Some prime numbers", [2, 3, 5, 7, 11, 13]);
   * ```
   */
  log: ActionLogFn
  /**
   * Sends a custom notification to Interval users via email or Slack. To send Slack notifications, you'll need to connect your Slack workspace to the Interval app in your organization settings.
   *
   * **Usage:**
   *
   * ```typescript
   * await ctx.notify({
   *   message: "A charge of $500 was refunded",
   *   title: "Refund over threshold",
   *   delivery: [
   *     {
   *       to: "#interval-notifications",
   *       method: "SLACK",
   *     },
   *     {
   *       to: "foo@example.com",
   *     },
   *   ],
   * });
   * ```
   */
  notify: NotifyFn
  /**
   * Perform a redirect to another action or an external URL in the user's current browser window.
   *
   * **Usage:**
   *
   * ```typescript
   * // To another action
   * await ctx.redirect({ action: "edit_user", params: { id: user.id } });
   *
   * // To an external URL
   * await ctx.redirect({ url: "https://example.com" });
   * ```
   */
  redirect: RedirectFn
  /**
   * Basic information about the organization.
   */
  organization: CtxOrganization
  /**
   * Information about the currently running action.
   */
  action: {
    /**
     * The current action's unique slug.
     */
    slug: string
    /**
     * The canonical absolute URL to access the individual action execution history.
     */
    url: string
  }
}

export type PageCtx = Pick<
  ActionCtx,
  'user' | 'params' | 'environment' | 'organization' | 'redirect' | 'loading'
> & {
  /**
   * Information about the currently open page.
   */
  page: {
    /**
     * The current page's unique slug.
     */
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
  handler: IntervalActionHandler
  backgroundable?: boolean
  unlisted?: boolean
  promptOnClose?: boolean
  name?: string
  description?: string
  access?: AccessControlDefinition
}

export type IntervalActionDefinition =
  | IntervalActionHandler
  | ExplicitIntervalActionDefinition
  | Action

export type IntervalRouteDefinitions = Record<
  string,
  IntervalActionDefinition | Page
>

export type IntervalPageHandler = (
  display: IO['display'],
  ctx: PageCtx
) => Promise<Layout | undefined>

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
  props?: Prettify<Props>
) => IOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type InputIOComponentFunction<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: Prettify<Props>
) => InputIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type RequiredPropsInputIOComponentFunction<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props: Prettify<Props>
) => InputIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type MultipleableInputIOComponentFunction<
  MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: Prettify<Props>
) => MultipleableIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type RequiredPropsMultipleableInputIOComponentFunction<
  MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props: Prettify<Props>
) => MultipleableIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type DisplayIOComponentFunction<
  MethodName extends T_IO_DISPLAY_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: Prettify<Props>
) => DisplayIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type RequiredPropsDisplayIOComponentFunction<
  MethodName extends T_IO_DISPLAY_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props: Prettify<Props>
) => DisplayIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type ExclusiveIOComponentFunction<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props,
  Output = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: Prettify<Props>
) => ExclusiveIOPromise<MethodName, T_IO_PROPS<MethodName>, Output>

export type ComponentRenderReturn<MethodName extends T_IO_METHOD_NAMES> = {
  choice?: string
  returnValue: [
    MaybeMultipleComponentReturnValue<MethodName>,
    ...MaybeMultipleComponentReturnValue<MethodName>[]
  ]
}

export type ComponentRenderer<MethodName extends T_IO_METHOD_NAMES> = ({
  components,
  choiceButtons,
}: {
  components: [IOComponent<MethodName>, ...IOComponent<MethodName>[]]
  validator?: IOClientRenderValidator<[AnyIOComponent, ...AnyIOComponent[]]>
  choiceButtons?: ChoiceButtonConfig[]
}) => Promise<ComponentRenderReturn<MethodName>>

export type ComponentsRendererReturn<Components> = {
  choice?: string
  returnValue: {
    [Idx in keyof Components]: Components[Idx] extends AnyIOComponent
      ? z.infer<Components[Idx]['schema']['returns']> | undefined
      : Components[Idx]
  }
}

export type ComponentsRenderer<
  Components extends [AnyIOComponent, ...AnyIOComponent[]] = [
    AnyIOComponent,
    ...AnyIOComponent[]
  ]
> = ({
  components,
  validator,
  choiceButtons,
}: {
  components: Components
  validator?: IOClientRenderValidator<Components>
  choiceButtons?: ChoiceButtonConfig[]
}) => Promise<ComponentsRendererReturn<Components>>

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

export type RedirectConfig = LegacyLinkProps & {
  replace?: boolean
}

export type RedirectFn = (props: RedirectConfig) => Promise<void>

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
  Output,
  DefaultValue = Output
> = (
  this: IOClient,
  props: Props,
  onPropsUpdate?: Evt<T_IO_PROPS<MethodName>>
) => {
  props?: T_IO_PROPS<MethodName>
  getValue?: (response: T_IO_RETURNS<MethodName>) => Output
  getDefaultValue?: (defaultValue: DefaultValue) => any
  onStateChange?: (
    newState: T_IO_STATE<MethodName>
  ) => Promise<T_IO_PROPS<MethodName>>
}

export type InternalMenuItem = z.input<typeof menuItem>
export type MenuItem = {
  label: string
  theme?: 'danger'
} & (
  | {
      route: string
      params?: SerializableRecord
      disabled?: boolean
    }
  // Deprecated in favor of `route`
  // TODO: Add TS deprecation soon
  | {
      action: string
      params?: SerializableRecord
      disabled?: boolean
    }
  | {
      url: string
      disabled?: boolean
    }
  | { disabled: true }
)

export type InternalButtonItem = z.input<typeof buttonItem>
export type ButtonItem = {
  label: string
  theme?: 'primary' | 'secondary' | 'danger'
} & (
  | { route: string; params?: SerializableRecord; disabled?: boolean }
  // Deprecated in favor of `route`
  // TODO: Add TS deprecation soon
  | { action: string; params?: SerializableRecord; disabled?: boolean }
  | { url: string; disabled?: boolean }
  | { disabled: true }
)

export type ButtonConfig = {
  label?: string
  theme?: ButtonTheme
}

export type ChoiceButtonConfig = {
  label: string
  value: string
  theme?: ButtonTheme
}

export type ChoiceButtonConfigOrShorthand<Choice> =
  | Choice
  | (ChoiceButtonConfig & { value: Choice })

export type GroupConfig = {
  /** @deprecated Please use the chained .withSubmit() method instead. */
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
      route?: string
      /** @deprecated Please use `route` instead. */
      action?: string
      params?: z.infer<typeof serializableRecord>
      highlightColor?: HighlightColor
    }
  | TableCellValue

export type ColumnKey<Row> = string & keyof Row

export type TableColumn<Row> = {
  label: string
} & (
  | {
      accessorKey: string & keyof Row
      renderCell?: (row: Row) => TableColumnResult
    }
  | {
      accessorKey?: string & keyof Row
      renderCell: (row: Row) => TableColumnResult
    }
)

export type PageError = {
  error: string
  message: string
  cause?: string
  layoutKey?: keyof BasicLayoutConfig
}

export type IntervalErrorProps = {
  error: Error | unknown
  route: string
  routeDefinition: Action | Page | undefined
  params: SerializableRecord
  environment: ActionEnvironment
  user: CtxUser
  organization: CtxOrganization
}

export type IntervalErrorHandler = (props: IntervalErrorProps) => void

export type EventualValue<T> = T | Promise<T> | (() => T) | (() => Promise<T>)
