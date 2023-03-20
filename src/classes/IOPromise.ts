import {
  ioSchema,
  T_IO_DISPLAY_METHOD_NAMES,
  T_IO_INPUT_METHOD_NAMES,
  T_IO_METHOD_NAMES,
  T_IO_MULTIPLEABLE_METHOD_NAMES,
  T_IO_PROPS,
  T_IO_RETURNS,
  T_IO_STATE,
} from '../ioSchema'
import IOComponent, {
  AnyIOComponent,
  ComponentReturnValue,
  MaybeMultipleComponentReturnValue,
} from './IOComponent'
import IOError from './IOError'
import {
  ComponentRenderer,
  ComponentsRenderer,
  GroupIOPromise,
  MaybeOptionalGroupIOPromise,
  OptionalGroupIOPromise,
  ButtonConfig,
  ChoiceButtonConfig,
} from '../types'
import { IOClientRenderReturnValues } from './IOClient'
import { z, ZodError } from 'zod'

interface IOPromiseProps<
  MethodName extends T_IO_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  ComponentOutput = ComponentReturnValue<MethodName>
> {
  renderer: ComponentRenderer<MethodName>
  methodName: MethodName
  label: string
  props: Props
  valueGetter?: (response: ComponentReturnValue<MethodName>) => ComponentOutput
  onStateChange?: (
    incomingState: T_IO_STATE<MethodName>
  ) => Promise<Partial<Props>>
  validator?: IOPromiseValidator<ComponentOutput> | undefined
  displayResolvesImmediately?: boolean
}

/**
 * A custom wrapper class that handles creating the underlying component
 * model when the IO call is to be rendered, and optionally transforming
 * the value received from Interval to a custom component return type.
 *
 * Can be `await`ed, which renders its own component by itself,
 * or rendered as a group along with other IOPromises.
 */
export class IOPromise<
  MethodName extends T_IO_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  ComponentOutput = ComponentReturnValue<MethodName>
> {
  /* @internal */ methodName: MethodName
  /* @internal */ renderer: ComponentRenderer<MethodName>
  protected label: string
  protected props: Props
  protected valueGetter:
    | ((response: ComponentReturnValue<MethodName>) => ComponentOutput)
    | undefined
  protected onStateChange:
    | ((incomingState: T_IO_STATE<MethodName>) => Promise<Partial<Props>>)
    | undefined
  /* @internal */ validator: IOPromiseValidator<ComponentOutput> | undefined
  protected displayResolvesImmediately: boolean | undefined

  constructor({
    renderer,
    methodName,
    label,
    props,
    valueGetter,
    onStateChange,
    validator,
    displayResolvesImmediately,
  }: IOPromiseProps<MethodName, Props, ComponentOutput>) {
    this.renderer = renderer
    this.methodName = methodName
    this.label = label
    this.props = props
    this.valueGetter = valueGetter
    this.onStateChange = onStateChange
    this.validator = validator
    this.displayResolvesImmediately = displayResolvesImmediately
  }

  then(
    resolve: (output: ComponentOutput) => void,
    reject?: (err: IOError) => void
  ) {
    this.renderer({ components: [this.component] })
      .then(({ returnValue: [result] }) => {
        const parsed = ioSchema[this.methodName].returns.parse(result)
        resolve(this.getValue(parsed))
      })
      .catch(err => {
        if (reject) {
          if (err instanceof ZodError) {
            // This should be caught already, primarily here for types
            reject(
              new IOError('BAD_RESPONSE', 'Received invalid response.', {
                cause: err,
              })
            )
          } else {
            reject(err)
          }
        }
      })
  }

  getValue(result: ComponentReturnValue<MethodName>): ComponentOutput {
    if (this.valueGetter) return this.valueGetter(result)

    return result as unknown as ComponentOutput
  }

  get component() {
    return new IOComponent({
      methodName: this.methodName,
      label: this.label,
      initialProps: this.props,
      onStateChange: this.onStateChange,
      displayResolvesImmediately: this.displayResolvesImmediately,
    })
  }
}

/**
 * A thin subtype of IOPromise that does nothing but mark the component
 * as "display" for display-only components.
 */
export class DisplayIOPromise<
  MethodName extends T_IO_DISPLAY_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  ComponentOutput = ComponentReturnValue<MethodName>
> extends IOPromise<MethodName, Props, ComponentOutput> {
  withChoices(
    choiceButtons: ChoiceButtonConfig[]
  ): WithChoicesIOPromise<MethodName, Props, ComponentOutput, typeof this> {
    return new WithChoicesIOPromise({
      internalPromise: this,
      choiceButtons,
    })
  }
}

export class InputIOPromise<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  ComponentOutput = ComponentReturnValue<MethodName>
> extends IOPromise<MethodName, Props, ComponentOutput> {
  get component() {
    return new IOComponent({
      methodName: this.methodName,
      label: this.label,
      initialProps: this.props,
      onStateChange: this.onStateChange,
      validator: this.validator ? this.#handleValidation.bind(this) : undefined,
      displayResolvesImmediately: this.displayResolvesImmediately,
    })
  }

  async #handleValidation(
    returnValue: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    // These should be caught already, primarily here for types
    if (returnValue === undefined) {
      return 'This field is required.'
    }

    const parsed = ioSchema[this.methodName].returns.safeParse(returnValue)
    if (parsed.success) {
      if (this.validator) {
        return this.validator(this.getValue(parsed.data))
      }
    } else {
      // shouldn't be hit, but just in case
      return 'Received invalid value for field.'
    }
  }

  validate(validator: IOPromiseValidator<ComponentOutput>): this {
    this.validator = validator

    return this
  }

  optional(
    isOptional?: true
  ): OptionalIOPromise<MethodName, Props, ComponentOutput>
  optional(
    isOptional?: false
  ): InputIOPromise<MethodName, Props, ComponentOutput>
  optional(
    isOptional?: boolean
  ):
    | OptionalIOPromise<MethodName, Props, ComponentOutput>
    | InputIOPromise<MethodName, Props, ComponentOutput>
  optional(
    isOptional = true
  ):
    | OptionalIOPromise<MethodName, Props, ComponentOutput>
    | InputIOPromise<MethodName, Props, ComponentOutput> {
    return isOptional
      ? new OptionalIOPromise({
          renderer: this.renderer,
          methodName: this.methodName,
          label: this.label,
          props: this.props,
          valueGetter: this.valueGetter,
          onStateChange: this.onStateChange,
        })
      : this
  }

  withChoices(
    choiceButtons: ChoiceButtonConfig[]
  ): WithChoicesIOPromise<MethodName, Props, ComponentOutput, typeof this> {
    return new WithChoicesIOPromise({
      internalPromise: this,
      choiceButtons,
    })
  }
}

/**
 * A thin subclass of IOPromise that marks its inner component as
 * "optional" and returns `undefined` if not provided by the action runner.
 */
export class OptionalIOPromise<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  ComponentOutput = ComponentReturnValue<MethodName>
> extends InputIOPromise<MethodName, Props, ComponentOutput | undefined> {
  then(
    resolve: (output: ComponentOutput | undefined) => void,
    reject?: (err: IOError) => void
  ) {
    this.renderer({ components: [this.component] })
      .then(({ returnValue: [result] }) => {
        const parsed = ioSchema[this.methodName].returns
          .optional()
          .parse(result)
        resolve(this.getValue(parsed))
      })
      .catch(err => {
        if (reject) {
          if (err instanceof ZodError) {
            // This should be caught already, primarily here for types
            reject(
              new IOError('BAD_RESPONSE', 'Received invalid response.', {
                cause: err,
              })
            )
          } else {
            reject(err)
          }
        }
      })
  }

  get component() {
    return new IOComponent({
      methodName: this.methodName,
      label: this.label,
      initialProps: this.props,
      onStateChange: this.onStateChange,
      isOptional: true,
      validator: this.validator ? this.#handleValidation.bind(this) : undefined,
      displayResolvesImmediately: this.displayResolvesImmediately,
    })
  }

  async #handleValidation(
    returnValue: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    // These should be caught already, primarily here for types
    const parsed = ioSchema[this.methodName].returns
      .optional()
      .safeParse(returnValue)
    if (parsed.success) {
      if (this.validator) {
        return this.validator(this.getValue(parsed.data))
      }
    } else {
      // shouldn't be hit, but just in case
      return 'Received invalid value for field.'
    }
  }

  getValue(
    result: ComponentReturnValue<MethodName> | undefined
  ): ComponentOutput | undefined {
    if (result === undefined) return undefined

    if (this.valueGetter) {
      return this.valueGetter(result)
    }

    return result as unknown as ComponentOutput
  }
}

export class MultipleableIOPromise<
  MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  ComponentOutput = ComponentReturnValue<MethodName>,
  DefaultValue = T_IO_PROPS<MethodName> extends { defaultValue?: any }
    ? ComponentOutput | null
    : never
> extends InputIOPromise<MethodName, Props, ComponentOutput> {
  defaultValueGetter:
    | ((defaultValue: DefaultValue) => T_IO_RETURNS<MethodName>)
    | undefined

  constructor({
    defaultValueGetter,
    ...props
  }: {
    renderer: ComponentRenderer<MethodName>
    methodName: MethodName
    label: string
    props: Props
    valueGetter?: (
      response: ComponentReturnValue<MethodName>
    ) => ComponentOutput
    defaultValueGetter?: (
      defaultValue: DefaultValue
    ) => T_IO_RETURNS<MethodName>
    onStateChange?: (
      incomingState: T_IO_STATE<MethodName>
    ) => Promise<Partial<Props>>
    validator?: IOPromiseValidator<ComponentOutput> | undefined
    displayResolvesImmediately?: boolean
  }) {
    super(props)
    this.defaultValueGetter = defaultValueGetter
  }

  multiple({
    defaultValue,
  }: {
    defaultValue?: DefaultValue[] | null
  } = {}): MultipleIOPromise<MethodName, Props, ComponentOutput> {
    let transformedDefaultValue: T_IO_RETURNS<MethodName>[] | undefined | null
    const propsSchema = ioSchema[this.methodName].props
    if (defaultValue && 'defaultValue' in propsSchema.shape) {
      const { defaultValueGetter } = this
      const potentialDefaultValue = defaultValueGetter
        ? defaultValue.map(dv => defaultValueGetter(dv))
        : (defaultValue as unknown as T_IO_RETURNS<MethodName>[])

      try {
        const defaultValueSchema = propsSchema.shape.defaultValue
        transformedDefaultValue = z
          .array(defaultValueSchema.unwrap().unwrap())
          .parse(potentialDefaultValue)
      } catch (err) {
        console.error(
          `[Interval] Invalid default value found for multiple IO call with label "${this.label}": ${defaultValue}. This default value will be ignored.`
        )
        console.error(err)
        transformedDefaultValue = undefined
      }
    }

    return new MultipleIOPromise<MethodName, Props, ComponentOutput>({
      renderer: this.renderer,
      methodName: this.methodName,
      label: this.label,
      props: this.props,
      valueGetter: this.valueGetter,
      onStateChange: this.onStateChange,
      defaultValue: transformedDefaultValue,
    })
  }

  withChoices(
    choiceButtons: ChoiceButtonConfig[]
  ): WithChoicesIOPromise<MethodName, Props, ComponentOutput, typeof this> {
    return new WithChoicesIOPromise({
      internalPromise: this,
      choiceButtons,
    })
  }
}

export class MultipleIOPromise<
  MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  ComponentOutput = ComponentReturnValue<MethodName>
> extends InputIOPromise<MethodName, Props, ComponentOutput[]> {
  getSingleValue:
    | ((response: ComponentReturnValue<MethodName>) => ComponentOutput)
    | undefined
  defaultValue: T_IO_RETURNS<MethodName>[] | undefined | null

  constructor({
    defaultValue,
    valueGetter,
    ...rest
  }: {
    defaultValue?: T_IO_RETURNS<MethodName>[] | null
    renderer: ComponentRenderer<MethodName>
    methodName: MethodName
    label: string
    props: Props
    valueGetter?: (
      response: ComponentReturnValue<MethodName>
    ) => ComponentOutput
    onStateChange?: (
      incomingState: T_IO_STATE<MethodName>
    ) => Promise<Partial<Props>>
    validator?: IOPromiseValidator<ComponentOutput[]> | undefined
  }) {
    super(rest)
    this.getSingleValue = valueGetter
    this.defaultValue = defaultValue
  }

  then(
    resolve: (output: ComponentOutput[]) => void,
    reject?: (err: IOError) => void
  ) {
    this.renderer({ components: [this.component] })
      .then(({ returnValue: [results] }) => {
        resolve(this.getValue(results))
      })
      .catch(err => {
        if (reject) reject(err)
      })
  }

  validate(validator: IOPromiseValidator<ComponentOutput[]>): this {
    this.validator = validator

    return this
  }

  getValue(
    results: MaybeMultipleComponentReturnValue<MethodName>
  ): ComponentOutput[] {
    if (!Array.isArray(results)) {
      results = [results]
    }

    const { getSingleValue } = this
    if (getSingleValue) {
      return results.map(result => getSingleValue(result))
    }

    return results as unknown as ComponentOutput[]
  }

  async #handleValidation(
    returnValues: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    // These should be caught already, primarily here for types
    if (!returnValues) {
      return 'This field is required.'
    }

    const parsed = z
      .array(ioSchema[this.methodName].returns)
      .safeParse(returnValues)
    if (parsed.success) {
      if (this.validator) {
        return this.validator(this.getValue(parsed.data))
      }
    } else {
      // shouldn't be hit, but just in case
      return 'Received invalid value for field.'
    }
  }

  get component() {
    return new IOComponent({
      methodName: this.methodName,
      label: this.label,
      initialProps: this.props,
      onStateChange: this.onStateChange,
      validator: this.validator ? this.#handleValidation.bind(this) : undefined,
      isMultiple: true,
      multipleProps: {
        defaultValue: this.defaultValue,
      },
      displayResolvesImmediately: this.displayResolvesImmediately,
    })
  }

  optional(
    isOptional?: true
  ): OptionalMultipleIOPromise<MethodName, Props, ComponentOutput>
  optional(
    isOptional?: false
  ): MultipleIOPromise<MethodName, Props, ComponentOutput>
  optional(
    isOptional?: boolean
  ):
    | OptionalMultipleIOPromise<MethodName, Props, ComponentOutput>
    | MultipleIOPromise<MethodName, Props, ComponentOutput>
  optional(
    isOptional = true
  ):
    | OptionalMultipleIOPromise<MethodName, Props, ComponentOutput>
    | MultipleIOPromise<MethodName, Props, ComponentOutput> {
    return isOptional
      ? new OptionalMultipleIOPromise<MethodName, Props, ComponentOutput>({
          renderer: this.renderer,
          methodName: this.methodName,
          label: this.label,
          props: this.props,
          valueGetter: this.getSingleValue,
          defaultValue: this.defaultValue,
          onStateChange: this.onStateChange,
        })
      : this
  }
}

export class OptionalMultipleIOPromise<
  MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  ComponentOutput = ComponentReturnValue<MethodName>
> extends OptionalIOPromise<MethodName, Props, ComponentOutput[]> {
  getSingleValue:
    | ((response: ComponentReturnValue<MethodName>) => ComponentOutput)
    | undefined
  defaultValue: T_IO_RETURNS<MethodName>[] | undefined | null

  constructor({
    defaultValue,
    valueGetter,
    ...rest
  }: {
    defaultValue?: T_IO_RETURNS<MethodName>[] | null
    renderer: ComponentRenderer<MethodName>
    methodName: MethodName
    label: string
    props: Props
    valueGetter?: (
      response: ComponentReturnValue<MethodName>
    ) => ComponentOutput
    onStateChange?: (
      incomingState: T_IO_STATE<MethodName>
    ) => Promise<Partial<Props>>
    validator?: IOPromiseValidator<ComponentOutput[] | undefined> | undefined
  }) {
    super(rest)
    this.getSingleValue = valueGetter
    this.defaultValue = defaultValue
  }

  then(
    resolve: (output: ComponentOutput[] | undefined) => void,
    reject?: (err: IOError) => void
  ) {
    this.renderer({ components: [this.component] })
      .then(({ returnValue: [results] }) => {
        resolve(this.getValue(results))
      })
      .catch(err => {
        if (reject) reject(err)
      })
  }

  validate(validator: IOPromiseValidator<ComponentOutput[] | undefined>): this {
    this.validator = validator

    return this
  }

  getValue(
    results: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): ComponentOutput[] | undefined {
    if (!results) return undefined

    if (!Array.isArray(results)) {
      results = [results]
    }

    const { getSingleValue } = this
    if (getSingleValue) {
      return results.map(result => getSingleValue(result))
    }

    return results as unknown as ComponentOutput[]
  }

  async #handleValidation(
    returnValues: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    // These should be caught already, primarily here for types
    const parsed = z
      .array(ioSchema[this.methodName].returns)
      .optional()
      .safeParse(returnValues)
    if (parsed.success) {
      if (this.validator) {
        return this.validator(this.getValue(parsed.data))
      }
    } else {
      console.debug(parsed)
      // shouldn't be hit, but just in case
      return 'Received invalid value for field.'
    }
  }

  get component() {
    return new IOComponent({
      methodName: this.methodName,
      label: this.label,
      initialProps: this.props,
      onStateChange: this.onStateChange,
      validator: this.validator ? this.#handleValidation.bind(this) : undefined,
      isMultiple: true,
      isOptional: true,
      multipleProps: {
        defaultValue: this.defaultValue,
      },
      displayResolvesImmediately: this.displayResolvesImmediately,
    })
  }
}

export class WithChoicesIOPromise<
  MethodName extends T_IO_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  ComponentOutput = ComponentReturnValue<MethodName>,
  InternalPromise extends IOPromise<
    MethodName,
    Props,
    ComponentOutput
  > = IOPromise<MethodName, Props, ComponentOutput>
> {
  internalPromise: InternalPromise
  choiceButtons: ChoiceButtonConfig[]

  constructor({
    internalPromise,
    choiceButtons,
  }: {
    internalPromise: InternalPromise
    choiceButtons: ChoiceButtonConfig[]
  }) {
    this.internalPromise = internalPromise
    this.choiceButtons = choiceButtons
  }

  then(
    resolve: (output: {
      choice?: string
      returnValue: ComponentOutput
    }) => void,
    reject?: (err: IOError) => void
  ) {
    this.internalPromise
      .renderer({
        components: [this.component],
        choiceButtons: this.choiceButtons,
      })
      .then(({ returnValue: [result], choice }) => {
        const methodName = this.internalPromise.methodName
        const parsed =
          this.internalPromise instanceof MultipleIOPromise ||
          this.internalPromise instanceof OptionalMultipleIOPromise
            ? result
            : this.internalPromise instanceof OptionalIOPromise
            ? ioSchema[methodName].returns.optional().parse(result)
            : ioSchema[methodName].returns.parse(result)

        // Need a cast here because can't really prove statically, the checks above should be correct though
        resolve({
          choice,
          returnValue: this.getValue(
            parsed as ComponentReturnValue<MethodName>
          ),
        })
      })
      .catch(err => {
        if (reject) {
          if (err instanceof ZodError) {
            // This should be caught already, primarily here for types
            reject(
              new IOError('BAD_RESPONSE', 'Received invalid response.', {
                cause: err,
              })
            )
          } else {
            reject(err)
          }
        }
      })
  }

  get getValue() {
    return this.internalPromise.getValue.bind(this.internalPromise)
  }

  get component() {
    return this.internalPromise.component
  }

  validate(validator: IOPromiseValidator<ComponentOutput>): this {
    this.internalPromise.validator = validator

    return this
  }

  // These overrides are pretty disgusting but are unavoidable I think
  optional<
    MethodName extends T_IO_INPUT_METHOD_NAMES,
    Props extends T_IO_PROPS<MethodName>,
    ComponentOutput = ComponentReturnValue<MethodName>
  >(
    this: WithChoicesIOPromise<
      MethodName,
      Props,
      ComponentOutput,
      InputIOPromise<MethodName, Props, ComponentOutput>
    >,
    isOptional?: true
  ): WithChoicesIOPromise<
    MethodName,
    Props,
    ComponentOutput | undefined,
    OptionalIOPromise<MethodName, Props, ComponentOutput>
  >
  optional<
    MethodName extends T_IO_INPUT_METHOD_NAMES,
    Props extends T_IO_PROPS<MethodName>,
    ComponentOutput = ComponentReturnValue<MethodName>
  >(
    this: WithChoicesIOPromise<
      MethodName,
      Props,
      ComponentOutput,
      InputIOPromise<MethodName, Props, ComponentOutput>
    >,
    isOptional?: false
  ): WithChoicesIOPromise<
    MethodName,
    Props,
    ComponentOutput,
    InputIOPromise<MethodName, Props, ComponentOutput>
  >
  optional<
    MethodName extends T_IO_INPUT_METHOD_NAMES,
    Props extends T_IO_PROPS<MethodName>,
    ComponentOutput = ComponentReturnValue<MethodName>
  >(
    this: WithChoicesIOPromise<
      MethodName,
      Props,
      ComponentOutput,
      InputIOPromise<MethodName, Props, ComponentOutput>
    >,
    isOptional?: boolean
  ):
    | WithChoicesIOPromise<
        MethodName,
        Props,
        ComponentOutput | undefined,
        OptionalIOPromise<MethodName, Props, ComponentOutput>
      >
    | WithChoicesIOPromise<
        MethodName,
        Props,
        ComponentOutput,
        InputIOPromise<MethodName, Props, ComponentOutput>
      >
  optional<
    MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
    Props extends T_IO_PROPS<MethodName>,
    ComponentOutput = ComponentReturnValue<MethodName>
  >(
    this: WithChoicesIOPromise<
      MethodName,
      Props,
      ComponentOutput[],
      MultipleIOPromise<MethodName, Props, ComponentOutput>
    >,
    isOptional?: true
  ): WithChoicesIOPromise<
    MethodName,
    Props,
    ComponentOutput[] | undefined,
    OptionalMultipleIOPromise<MethodName, Props, ComponentOutput>
  >
  optional<
    MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
    Props extends T_IO_PROPS<MethodName>,
    ComponentOutput = ComponentReturnValue<MethodName>
  >(
    this: WithChoicesIOPromise<
      MethodName,
      Props,
      ComponentOutput[],
      MultipleIOPromise<MethodName, Props, ComponentOutput>
    >,
    isOptional?: false
  ): WithChoicesIOPromise<
    MethodName,
    Props,
    ComponentOutput[],
    MultipleIOPromise<MethodName, Props, ComponentOutput>
  >
  optional<
    MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
    Props extends T_IO_PROPS<MethodName>,
    ComponentOutput = ComponentReturnValue<MethodName>
  >(
    this: WithChoicesIOPromise<
      MethodName,
      Props,
      ComponentOutput[],
      MultipleIOPromise<MethodName, Props, ComponentOutput>
    >,
    isOptional?: boolean
  ):
    | WithChoicesIOPromise<
        MethodName,
        Props,
        ComponentOutput[] | undefined,
        OptionalMultipleIOPromise<MethodName, Props, ComponentOutput>
      >
    | WithChoicesIOPromise<
        MethodName,
        Props,
        ComponentOutput[],
        MultipleIOPromise<MethodName, Props, ComponentOutput>
      >
  optional<
    MethodName extends T_IO_INPUT_METHOD_NAMES,
    Props extends T_IO_PROPS<MethodName>,
    ComponentOutput = ComponentReturnValue<MethodName>
  >(
    this: WithChoicesIOPromise<
      MethodName,
      Props,
      ComponentOutput,
      InputIOPromise<MethodName, Props, ComponentOutput>
    >,
    isOptional = true
  ):
    | WithChoicesIOPromise<
        MethodName,
        Props,
        ComponentOutput | undefined,
        OptionalIOPromise<MethodName, Props, ComponentOutput>
      >
    | WithChoicesIOPromise<
        MethodName,
        Props,
        ComponentOutput,
        InputIOPromise<MethodName, Props, ComponentOutput>
      > {
    if (!(this.internalPromise instanceof InputIOPromise)) {
      throw new Error('Not implemented.')
    }

    return isOptional
      ? new WithChoicesIOPromise({
          internalPromise: this.internalPromise.optional(isOptional),
          choiceButtons: this.choiceButtons,
        })
      : this
  }

  multiple<
    MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
    Props extends T_IO_PROPS<MethodName>,
    ComponentOutput = ComponentReturnValue<MethodName>,
    DefaultValue = T_IO_PROPS<MethodName> extends { defaultValue?: any }
      ? ComponentOutput | null
      : never
  >(
    this: WithChoicesIOPromise<
      MethodName,
      Props,
      ComponentOutput,
      MultipleableIOPromise<MethodName, Props, ComponentOutput, DefaultValue>
    >,
    {
      defaultValue,
    }: {
      defaultValue?: DefaultValue[] | null
    } = {}
  ): WithChoicesIOPromise<
    MethodName,
    Props,
    ComponentOutput[],
    MultipleIOPromise<MethodName, Props, ComponentOutput>
  > {
    if (!(this.internalPromise instanceof MultipleableIOPromise)) {
      throw new Error('Not implemented.')
    }

    return new WithChoicesIOPromise({
      internalPromise: this.internalPromise.multiple({ defaultValue }),
      choiceButtons: this.choiceButtons,
    })
  }

  withChoices(choiceButtons: ChoiceButtonConfig[]) {
    this.choiceButtons = choiceButtons

    return this
  }
}

/**
 * A thin subclass of IOPromise that does nothing but mark the component
 * as "exclusive" for components that cannot be rendered in a group.
 * Also cannot be optional at this time.
 */
export class ExclusiveIOPromise<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  ComponentOutput = ComponentReturnValue<MethodName>
> extends IOPromise<MethodName, Props, ComponentOutput> {
  get component() {
    return new IOComponent({
      methodName: this.methodName,
      label: this.label,
      initialProps: this.props,
      onStateChange: this.onStateChange,
      isOptional: false,
      validator: this.validator ? this.#handleValidation.bind(this) : undefined,
      displayResolvesImmediately: this.displayResolvesImmediately,
    })
  }

  async #handleValidation(
    returnValue: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    // These should be caught already, primarily here for types
    if (returnValue === undefined) {
      return 'This field is required.'
    }

    const parsed = ioSchema[this.methodName].returns.safeParse(returnValue)
    if (parsed.success) {
      if (this.validator) {
        return this.validator(this.getValue(parsed.data))
      }
    } else {
      // shouldn't be hit, but just in case
      return 'Received invalid value for field.'
    }
  }

  validate(validator: IOPromiseValidator<ComponentOutput>): this {
    this.validator = validator

    return this
  }
}

export type IOGroupReturnValues<
  IOPromises extends
    | Record<string, MaybeOptionalGroupIOPromise>
    | [MaybeOptionalGroupIOPromise, ...MaybeOptionalGroupIOPromise[]]
> = {
  [Idx in keyof IOPromises]: IOPromises[Idx] extends
    | GroupIOPromise
    | OptionalGroupIOPromise
    ? ReturnType<IOPromises[Idx]['getValue']>
    : IOPromises[Idx]
}

export type IOGroupComponents<
  IOPromises extends [
    MaybeOptionalGroupIOPromise,
    ...MaybeOptionalGroupIOPromise[]
  ]
> = {
  [Idx in keyof IOPromises]: IOPromises[Idx] extends
    | GroupIOPromise
    | OptionalGroupIOPromise
    ? IOPromises[Idx]['component']
    : IOPromises[Idx]
}

export type IOPromiseValidator<ComponentOutput> = (
  returnValue: ComponentOutput
) => string | undefined | Promise<string | undefined>

export class IOGroupPromise<
  IOPromises extends
    | Record<string, MaybeOptionalGroupIOPromise>
    | MaybeOptionalGroupIOPromise[],
  ReturnValues = IOPromises extends Record<string, MaybeOptionalGroupIOPromise>
    ? { [K in keyof IOPromises]: ReturnType<IOPromises[K]['getValue']> }
    : IOPromises extends [
        MaybeOptionalGroupIOPromise,
        ...MaybeOptionalGroupIOPromise[]
      ]
    ? IOGroupReturnValues<IOPromises>
    : unknown[]
> {
  promises: IOPromises
  #renderer: ComponentsRenderer
  #validator: IOPromiseValidator<ReturnValues> | undefined

  #choiceButtons: ChoiceButtonConfig[] | undefined

  constructor(config: {
    promises: IOPromises
    renderer: ComponentsRenderer
    continueButton?: ButtonConfig
  }) {
    this.promises = config.promises
    this.#renderer = config.renderer
    this.#choiceButtons = config.continueButton
      ? [
          {
            label: config.continueButton.label || 'Continue',
            theme: config.continueButton.theme,
          },
        ]
      : undefined
  }

  get promiseValues(): MaybeOptionalGroupIOPromise[] {
    return Array.isArray(this.promises)
      ? this.promises
      : Object.values(this.promises)
  }

  then(
    resolve: (output: ReturnValues) => void,
    reject?: (err: IOError) => void
  ) {
    const promiseValues = this.promiseValues

    this.#renderer({
      components: promiseValues.map(p => p.component) as unknown as [
        AnyIOComponent,
        ...AnyIOComponent[]
      ],
      validator: this.#validator
        ? this.#handleValidation.bind(this)
        : undefined,
      choiceButtons: this.#choiceButtons,
    })
      .then(({ returnValue }) => {
        let returnValues = returnValue.map((val, i) =>
          promiseValues[i].getValue(val as never)
        )

        if (Array.isArray(this.promises)) {
          resolve(returnValues as unknown as ReturnValues)
        } else {
          const keys = Object.keys(this.promises)
          resolve(
            Object.fromEntries(
              returnValues.map((val, i) => [keys[i], val])
            ) as ReturnValues
          )
        }
      })
      .catch(err => {
        if (reject) reject(err)
      })
  }

  validate(validator: IOPromiseValidator<ReturnValues> | undefined): this {
    this.#validator = validator

    return this
  }

  // These types aren't as tight as they could be, but
  // TypeScript doesn't like IOGroupComponents defined above here
  async #handleValidation(
    returnValues: IOClientRenderReturnValues<
      [AnyIOComponent, ...AnyIOComponent[]]
    >
  ): Promise<string | undefined> {
    if (!this.#validator) return

    const promiseValues = this.promiseValues

    const values = returnValues.returnValue.map((v, index) =>
      promiseValues[index].getValue(v as never)
    )

    if (Array.isArray(this.promises)) {
      return this.#validator(values as unknown as ReturnValues)
    } else {
      const keys = Object.keys(this.promises)
      const valueMap = Object.fromEntries(
        values.map((val, i) => [keys[i], val])
      )

      return this.#validator(valueMap as ReturnValues)
    }
  }

  withChoices(
    choiceButtons: ChoiceButtonConfig[]
  ): IOGroupPromiseWithChoices<IOPromises, ReturnValues> {
    return new IOGroupPromiseWithChoices({
      promises: this.promises,
      renderer: this.#renderer,
      choiceButtons,
    })
  }
}

export class IOGroupPromiseWithChoices<
  IOPromises extends
    | Record<string, MaybeOptionalGroupIOPromise>
    | MaybeOptionalGroupIOPromise[],
  ReturnValues = IOPromises extends Record<string, MaybeOptionalGroupIOPromise>
    ? { [K in keyof IOPromises]: ReturnType<IOPromises[K]['getValue']> }
    : IOPromises extends [
        MaybeOptionalGroupIOPromise,
        ...MaybeOptionalGroupIOPromise[]
      ]
    ? IOGroupReturnValues<IOPromises>
    : unknown[]
> {
  promises: IOPromises
  #renderer: ComponentsRenderer
  #validator: IOPromiseValidator<ReturnValues> | undefined

  #choiceButtons: ChoiceButtonConfig[] | undefined

  constructor(config: {
    promises: IOPromises
    renderer: ComponentsRenderer
    choiceButtons?: ChoiceButtonConfig[]
  }) {
    this.promises = config.promises
    this.#renderer = config.renderer
    this.#choiceButtons = config.choiceButtons
  }

  get promiseValues(): MaybeOptionalGroupIOPromise[] {
    return Array.isArray(this.promises)
      ? this.promises
      : Object.values(this.promises)
  }

  then(
    resolve: (output: { choice?: string; returnValue: ReturnValues }) => void,
    reject?: (err: IOError) => void
  ) {
    const promiseValues = this.promiseValues

    this.#renderer({
      components: promiseValues.map(p => p.component) as unknown as [
        AnyIOComponent,
        ...AnyIOComponent[]
      ],
      validator: this.#validator
        ? this.#handleValidation.bind(this)
        : undefined,
      choiceButtons: this.#choiceButtons,
    })
      .then(({ returnValue, choice }) => {
        let returnValues = returnValue.map((val, i) =>
          promiseValues[i].getValue(val as never)
        )

        if (Array.isArray(this.promises)) {
          resolve({
            choice,
            returnValue: returnValue as unknown as ReturnValues,
          })
        } else {
          const keys = Object.keys(this.promises)
          resolve({
            choice,
            returnValue: Object.fromEntries(
              returnValues.map((val, i) => [keys[i], val])
            ) as ReturnValues,
          })
        }
      })
      .catch(err => {
        if (reject) reject(err)
      })
  }

  validate(validator: IOPromiseValidator<ReturnValues> | undefined): this {
    this.#validator = validator

    return this
  }

  // These types aren't as tight as they could be, but
  // TypeScript doesn't like IOGroupComponents defined above here
  async #handleValidation(
    returnValues: IOClientRenderReturnValues<
      [AnyIOComponent, ...AnyIOComponent[]]
    >
  ): Promise<string | undefined> {
    if (!this.#validator) return

    const promiseValues = this.promiseValues

    const values = returnValues.returnValue.map((v, index) =>
      promiseValues[index].getValue(v as never)
    )

    if (Array.isArray(this.promises)) {
      return this.#validator(values as unknown as ReturnValues)
    } else {
      const keys = Object.keys(this.promises)
      const valueMap = Object.fromEntries(
        values.map((val, i) => [keys[i], val])
      )

      return this.#validator(valueMap as ReturnValues)
    }
  }

  withChoices(
    choiceButtons: ChoiceButtonConfig[]
  ): IOGroupPromiseWithChoices<IOPromises, ReturnValues> {
    return new IOGroupPromiseWithChoices({
      promises: this.promises,
      renderer: this.#renderer,
      choiceButtons,
    })
  }
}
