import { z } from 'zod'
import {
  ioSchema,
  resolvesImmediately,
  T_IO_DISPLAY_METHOD_NAMES,
  T_IO_METHOD_NAMES,
  T_IO_RETURNS,
} from '../ioSchema'
import { deserializeDates } from '../utils/deserialize'
import { IOPromiseValidator } from './IOPromise'

type IoSchema = typeof ioSchema
export interface ComponentInstance<MN extends keyof IoSchema> {
  methodName: MN
  label: string
  props?: z.input<IoSchema[MN]['props']>
  state: z.infer<IoSchema[MN]['state']>
  isStateful?: boolean
  isOptional?: boolean
  validationErrorMessage?: string | undefined
}

export type ComponentRenderInfo<MN extends keyof IoSchema> = Omit<
  ComponentInstance<MN>,
  'state'
>

export type ComponentReturnValue<MN extends keyof IoSchema> = T_IO_RETURNS<MN>

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
    | ((v: ComponentReturnValue<MethodName> | undefined) => void)
    | undefined
  returnValue: Promise<ComponentReturnValue<MethodName> | undefined>
  onStateChangeHandler: (() => void) | undefined
  handleStateChange:
    | ((
        incomingState: z.infer<IoSchema[MethodName]['state']>
      ) => Promise<Partial<z.input<IoSchema[MethodName]['props']>>>)
    | undefined

  validator:
    | IOPromiseValidator<ComponentReturnValue<MethodName> | undefined>
    | undefined

  /**
   * @param methodName - The component's method name from ioSchema, used
   * to determine the valid types for communication with Interval.
   * @param label - The UI label to be displayed to the action runner.
   * @param initialProps - The properties send to Interval for the initial
   * render call.
   * @param handleStateChange - A handler that converts new state received
   * from Interval into a new set of props.
   * @param isOptional - If true, the input can be omitted by the action
   * runner, in which case the component will accept and return `undefined`.
   */
  constructor(
    methodName: MethodName,
    label: string,
    initialProps?: z.input<IoSchema[MethodName]['props']>,
    handleStateChange?: (
      incomingState: z.infer<IoSchema[MethodName]['state']>
    ) => Promise<Partial<z.input<IoSchema[MethodName]['props']>>>,
    isOptional: boolean = false,
    validator?: IOPromiseValidator<ComponentReturnValue<MethodName> | undefined>
  ) {
    this.handleStateChange = handleStateChange
    this.schema = ioSchema[methodName]
    this.validator = validator

    try {
      initialProps = this.schema.props.parse(initialProps ?? {})
    } catch (err) {
      console.error(`Invalid props found for IO call with label "${label}":`)
      console.error(err)
      throw err
    }

    this.instance = {
      methodName,
      label,
      props: initialProps,
      state: null,
      isStateful: !!handleStateChange,
      isOptional: isOptional,
    }

    this.returnValue = new Promise<
      ComponentReturnValue<MethodName> | undefined
    >(resolve => {
      this.resolver = resolve
    })

    // Immediately resolve any methods defined as immediate in schema
    setImmediate(() => {
      if (resolvesImmediately(methodName) && this.resolver) {
        this.resolver(null)
      }
    })
  }

  async handleValidation(
    returnValue: ComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    if (this.validator) {
      const message = await this.validator(returnValue)
      this.instance.validationErrorMessage = message
      return message
    }
  }

  setReturnValue(value: z.input<IoSchema[MethodName]['returns']>) {
    const returnSchema = this.instance.isOptional
      ? this.schema.returns
          .nullable()
          .optional()
          // JSON.stringify turns undefined into null in arrays
          .transform(value => value ?? undefined)
      : this.schema.returns

    try {
      let parsed: ReturnType<typeof returnSchema.parse>

      if (value && typeof value === 'object') {
        // TODO: Remove this when all active SDKs support superjson
        if (Array.isArray(value)) {
          parsed = returnSchema.parse(value.map(v => deserializeDates<any>(v)))
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
      console.error('Received invalid return value:', err)
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
      console.error('Received invalid state:', err)
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
      validationErrorMessage: this.instance.validationErrorMessage,
    }
  }
}
