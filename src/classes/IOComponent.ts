import { z, ZodError } from 'zod'
import { Evt } from 'evt'
import {
  ioSchema,
  resolvesImmediately,
  T_IO_DISPLAY_METHOD_NAMES,
  T_IO_METHOD_NAMES,
  T_IO_PROPS,
  T_IO_RETURNS,
  T_IO_STATE,
} from '../ioSchema'
import { deserializeDates } from '../utils/deserialize'
import IOError from './IOError'
import { IOPromiseValidator } from './IOPromise'

type IoSchema = typeof ioSchema
export interface ComponentInstance<MN extends keyof IoSchema> {
  methodName: MN
  label: string
  props?: T_IO_PROPS<MN>
  state: T_IO_STATE<MN>
  isStateful?: boolean
  isOptional?: boolean
  isMultiple?: boolean
  validationErrorMessage?: string | undefined
  multipleProps?: {
    defaultValue?: T_IO_RETURNS<MN>[] | null
  }
}

export type ComponentRenderInfo<MN extends keyof IoSchema> = Omit<
  ComponentInstance<MN>,
  'state'
>

export type ComponentReturnValue<MN extends keyof IoSchema> = T_IO_RETURNS<MN>

export type MaybeMultipleComponentReturnValue<MN extends keyof IoSchema> =
  | T_IO_RETURNS<MN>
  | T_IO_RETURNS<MN>[]

export type IOComponentMap = {
  [MethodName in T_IO_METHOD_NAMES]: IOComponent<MethodName>
}

export type AnyIOComponent = IOComponentMap[keyof IoSchema]

export type DisplayComponentMap = {
  [MethodName in T_IO_DISPLAY_METHOD_NAMES]: IOComponent<MethodName>
}

export type AnyDisplayComponent = DisplayComponentMap[T_IO_DISPLAY_METHOD_NAMES]

/**
 * The internal model underlying each IOPromise, responsible for constructing
 * the data transmitted to Interval for an IO component, and handling responses
 * received from Interval.
 */
export default class IOComponent<MethodName extends T_IO_METHOD_NAMES> {
  schema: IoSchema[MethodName]
  instance: ComponentInstance<MethodName>
  resolver:
    | ((v: MaybeMultipleComponentReturnValue<MethodName> | undefined) => void)
    | undefined
  returnValue: Promise<
    MaybeMultipleComponentReturnValue<MethodName> | undefined
  >
  onStateChangeHandler: (() => void) | undefined
  handleStateChange:
    | ((
        incomingState: z.infer<IoSchema[MethodName]['state']>
      ) => Promise<Partial<z.input<IoSchema[MethodName]['props']>>>)
    | undefined
  onPropsUpdate: (() => T_IO_PROPS<MethodName>) | undefined

  validator:
    | IOPromiseValidator<
        MaybeMultipleComponentReturnValue<MethodName> | undefined
      >
    | undefined

  resolvesImmediately = false

  /**
   * @param options.methodName - The component's method name from ioSchema, used
   * to determine the valid types for communication with Interval.
   * @param options.label - The UI label to be displayed to the action runner.
   * @param options.initialProps - The properties send to Interval for the initial
   * render call.
   * @param options.handleStateChange - A handler that converts new state received
   * from Interval into a new set of props.
   * @param options.isOptional - If true, the input can be omitted by the action
   * runner, in which case the component will accept and return `undefined`.
   */
  constructor({
    methodName,
    label,
    initialProps,
    onStateChange,
    isOptional = false,
    isMultiple = false,
    validator,
    multipleProps,
    displayResolvesImmediately,
    onPropsUpdate,
  }: {
    methodName: MethodName
    label: string
    initialProps?: T_IO_PROPS<MethodName>
    onStateChange?: (
      incomingState: T_IO_STATE<MethodName>
    ) => Promise<Partial<T_IO_PROPS<MethodName>>>
    isOptional?: boolean
    isMultiple?: boolean
    validator?: IOPromiseValidator<
      MaybeMultipleComponentReturnValue<MethodName> | undefined
    >
    multipleProps?: {
      defaultValue?: T_IO_RETURNS<MethodName>[] | null
    }
    displayResolvesImmediately?: boolean
    onPropsUpdate?: Evt<T_IO_PROPS<MethodName>>
  }) {
    this.handleStateChange = onStateChange
    this.schema = ioSchema[methodName]
    this.validator = validator

    if (onPropsUpdate) {
      onPropsUpdate.attach(this.setProps.bind(this))
    }

    try {
      initialProps = this.schema.props.parse(initialProps ?? {})
    } catch (err) {
      console.error(
        `[Interval] Invalid props found for IO call with label "${label}":`
      )
      console.error(err)
      throw err
    }

    this.instance = {
      methodName,
      label,
      props: initialProps,
      state: null,
      isStateful: !!onStateChange,
      isOptional: isOptional,
      isMultiple: isMultiple,
      multipleProps,
    }

    this.returnValue = new Promise<
      MaybeMultipleComponentReturnValue<MethodName> | undefined
    >(resolve => {
      this.resolver = resolve
    })

    this.resolvesImmediately = resolvesImmediately(methodName, {
      displayResolvesImmediately,
    })
  }

  async handleValidation(
    returnValue: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    if (this.validator) {
      const message = await this.validator(returnValue)
      this.instance.validationErrorMessage = message
      return message
    }
  }

  setReturnValue(value: z.input<IoSchema[MethodName]['returns']>) {
    let requiredReturnSchema:
      | IoSchema[MethodName]['returns']
      | z.ZodArray<IoSchema[MethodName]['returns']> = this.schema.returns

    if (this.instance.isMultiple) {
      requiredReturnSchema = z.array(requiredReturnSchema)
    }

    const returnSchema = this.instance.isOptional
      ? requiredReturnSchema
          .nullable()
          .optional()
          // JSON.stringify turns undefined into null in arrays
          .transform(value => value ?? undefined)
      : requiredReturnSchema

    try {
      let parsed: ReturnType<typeof returnSchema.parse>

      if (value && typeof value === 'object') {
        // TODO: Remove this when all active SDKs support superjson
        if (Array.isArray(value)) {
          parsed = returnSchema.parse(
            value.map(v =>
              typeof v === 'object' && !Array.isArray(v)
                ? deserializeDates<any>(v)
                : v
            )
          )
        } else {
          parsed = returnSchema.parse(deserializeDates<any>(value))
        }
      } else {
        parsed = returnSchema.parse(value)
      }

      if (this.resolver) {
        this.resolver(parsed)
      }
    } catch (err) {
      const ioError = new IOError(
        'BAD_RESPONSE',
        'Received invalid return value',
        { cause: err }
      )
      throw ioError
    }
  }

  async setState(
    newState: z.infer<IoSchema[MethodName]['state']>
  ): Promise<ComponentInstance<MethodName>> {
    try {
      const parsedState = this.schema.state.parse(newState)
      if (this.handleStateChange) {
        this.instance.props = {
          ...this.instance.props,
          ...(await this.handleStateChange(parsedState)),
        }
      }
      this.instance.state = parsedState
      if (parsedState !== null && !this.handleStateChange) {
        console.warn(
          'Received non-null state, but no method was defined to handle.'
        )
      }
      this.onStateChangeHandler && this.onStateChangeHandler()
    } catch (err) {
      if (err instanceof ZodError) {
        const ioError = new IOError('BAD_RESPONSE', 'Received invalid state')
        ioError.cause = err
        throw ioError
      } else {
        const ioError = new IOError(
          'RESPONSE_HANDLER_ERROR',
          'Error in state change handler'
        )
        ioError.cause = err
        throw ioError
      }
    }

    return this.instance
  }

  setProps(newProps: z.input<IoSchema[MethodName]['props']>) {
    this.instance.props = newProps
    this.onStateChangeHandler && this.onStateChangeHandler()
  }

  getInstance() {
    return this.instance
  }

  get label() {
    return this.instance.label
  }

  onStateChange(handler: () => void) {
    this.onStateChangeHandler = handler
  }

  getRenderInfo(): ComponentRenderInfo<MethodName> {
    return {
      methodName: this.instance.methodName,
      label: this.instance.label,
      props: this.instance.props,
      isStateful: this.instance.isStateful,
      isOptional: this.instance.isOptional,
      isMultiple: this.instance.isMultiple,
      validationErrorMessage: this.instance.validationErrorMessage,
      multipleProps: this.instance.multipleProps,
    }
  }
}
