import {
  T_IO_DISPLAY_METHOD_NAMES,
  T_IO_INPUT_METHOD_NAMES,
  T_IO_METHOD_NAMES,
  T_IO_MULTIPLEABLE_METHOD_NAMES,
  T_IO_PROPS,
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
} from '../types'
import { IOClientRenderReturnValues } from './IOClient'

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
  Output = ComponentReturnValue<MethodName>
> {
  protected methodName: MethodName
  protected renderer: ComponentRenderer<MethodName>
  protected label: string
  protected props: Props
  protected valueGetter:
    | ((response: ComponentReturnValue<MethodName>) => Output)
    | undefined
  protected onStateChange:
    | ((incomingState: T_IO_STATE<MethodName>) => Promise<Partial<Props>>)
    | undefined
  protected validator: IOPromiseValidator<Output> | undefined

  constructor({
    renderer,
    methodName,
    label,
    props,
    valueGetter,
    onStateChange,
    validator,
  }: {
    renderer: ComponentRenderer<MethodName>
    methodName: MethodName
    label: string
    props: Props
    valueGetter?: (response: ComponentReturnValue<MethodName>) => Output
    onStateChange?: (
      incomingState: T_IO_STATE<MethodName>
    ) => Promise<Partial<Props>>
    validator?: IOPromiseValidator<Output> | undefined
  }) {
    this.renderer = renderer
    this.methodName = methodName
    this.label = label
    this.props = props
    this.valueGetter = valueGetter
    this.onStateChange = onStateChange
    this.validator = validator
  }

  then(resolve: (output: Output) => void, reject?: (err: IOError) => void) {
    this.renderer([this.component])
      .then(([result]) => {
        resolve(this.getValue(result as ComponentReturnValue<MethodName>))
      })
      .catch(err => {
        if (reject) reject(err)
      })
  }

  getValue(result: ComponentReturnValue<MethodName>): Output {
    if (this.valueGetter) return this.valueGetter(result)

    return result as unknown as Output
  }

  get component() {
    return new IOComponent({
      methodName: this.methodName,
      label: this.label,
      initialProps: this.props,
      onStateChange: this.onStateChange,
      isOptional: false,
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
  Output = ComponentReturnValue<MethodName>
> extends IOPromise<MethodName, Props, Output> {}

export class InputIOPromise<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  Output = ComponentReturnValue<MethodName>
> extends IOPromise<MethodName, Props, Output> {
  get component() {
    return new IOComponent({
      methodName: this.methodName,
      label: this.label,
      initialProps: this.props,
      onStateChange: this.onStateChange,
      isOptional: false,
      validator: this.validator ? this.#handleValidation.bind(this) : undefined,
    })
  }

  async #handleValidation(
    returnValue: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    // These should be caught already, primarily here for types
    if (returnValue === undefined) {
      return 'This field is required.'
    }

    if (Array.isArray(returnValue)) {
      return 'This field accepts only one value.'
    }

    if (this.validator) {
      return this.validator(this.getValue(returnValue))
    }
  }

  validate(validator: IOPromiseValidator<Output>): this {
    this.validator = validator

    return this
  }

  optional(isOptional?: true): OptionalIOPromise<MethodName, Props, Output>
  optional(isOptional?: false): IOPromise<MethodName, Props, Output>
  optional(
    isOptional?: boolean
  ):
    | OptionalIOPromise<MethodName, Props, Output>
    | IOPromise<MethodName, Props, Output>
  optional(
    isOptional = true
  ):
    | OptionalIOPromise<MethodName, Props, Output>
    | IOPromise<MethodName, Props, Output> {
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
}

/**
 * A thin subclass of IOPromise that marks its inner component as
 * "optional" and returns `undefined` if not provided by the action runner.
 */
export class OptionalIOPromise<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  Output = ComponentReturnValue<MethodName>
> extends InputIOPromise<MethodName, Props, Output | undefined> {
  then(
    resolve: (output: Output | undefined) => void,
    reject?: (err: IOError) => void
  ) {
    this.renderer([this.component])
      .then(([result]) => {
        resolve(this.getValue(result))
      })
      .catch(err => {
        if (reject) reject(err)
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
    })
  }

  async #handleValidation(
    returnValue: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    if (Array.isArray(returnValue)) {
      return 'This field accepts only one value.'
    }

    if (this.validator) {
      return this.validator(this.getValue(returnValue))
    }
  }

  getValue(
    result: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): Output | undefined {
    if (result === undefined) return undefined

    if (this.valueGetter) {
      // This should never be multiple()
      return this.valueGetter(result as ComponentReturnValue<MethodName>)
    }

    return result as unknown as Output
  }
}

export class MultipleableIOPromise<
  MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  Output = ComponentReturnValue<MethodName>
> extends InputIOPromise<MethodName, Props, Output> {
  constructor(props: {
    renderer: ComponentRenderer<MethodName>
    methodName: MethodName
    label: string
    props: Props
    valueGetter?: (response: ComponentReturnValue<MethodName>) => Output
    onStateChange?: (
      incomingState: T_IO_STATE<MethodName>
    ) => Promise<Partial<Props>>
    validator?: IOPromiseValidator<Output> | undefined
  }) {
    super(props)
  }

  multiple() {
    return new MultipleIOPromise<MethodName, Props, Output>({
      renderer: this.renderer,
      methodName: this.methodName,
      label: this.label,
      props: this.props,
      valueGetter: this.valueGetter,
      onStateChange: this.onStateChange,
    })
  }
}

export class MultipleIOPromise<
  MethodName extends T_IO_MULTIPLEABLE_METHOD_NAMES,
  Props extends T_IO_PROPS<MethodName> = T_IO_PROPS<MethodName>,
  Output = ComponentReturnValue<MethodName>
> extends IOPromise<MethodName, Props, Output[]> {
  getSingleValue:
    | ((response: ComponentReturnValue<MethodName>) => Output)
    | undefined

  constructor({
    valueGetter,
    ...rest
  }: {
    renderer: ComponentRenderer<MethodName>
    methodName: MethodName
    label: string
    props: Props
    valueGetter?: (response: ComponentReturnValue<MethodName>) => Output
    onStateChange?: (
      incomingState: T_IO_STATE<MethodName>
    ) => Promise<Partial<Props>>
    validator?: IOPromiseValidator<Output[]> | undefined
  }) {
    super(rest)
    this.getSingleValue = valueGetter
  }

  then(resolve: (output: Output[]) => void, reject?: (err: IOError) => void) {
    this.renderer([this.component])
      .then(([results]) => {
        resolve(this.getValue(results))
      })
      .catch(err => {
        if (reject) reject(err)
      })
  }

  validate(validator: IOPromiseValidator<Output[]>): this {
    this.validator = validator

    return this
  }

  getValue(results: MaybeMultipleComponentReturnValue<MethodName>): Output[] {
    if (!Array.isArray(results)) {
      results = [results]
    }

    const { getSingleValue } = this
    if (getSingleValue) {
      return results.map(result => getSingleValue(result))
    }

    return results as unknown as Output[]
  }

  async #handleValidation(
    returnValues: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    // These should be caught already, primarily here for types
    if (!returnValues) {
      return 'This field is required.'
    }

    if (!Array.isArray(returnValues)) {
      return 'This field accepts only multiple values.'
    }

    if (this.validator) {
      return this.validator(this.getValue(returnValues))
    }
  }

  get component() {
    return new IOComponent({
      methodName: this.methodName,
      label: this.label,
      initialProps: this.props,
      onStateChange: this.onStateChange,
      isMultiple: true,
      validator: this.validator ? this.#handleValidation.bind(this) : undefined,
    })
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
  Output = ComponentReturnValue<MethodName>
> extends IOPromise<MethodName, Props, Output> {
  get component() {
    return new IOComponent({
      methodName: this.methodName,
      label: this.label,
      initialProps: this.props,
      onStateChange: this.onStateChange,
      isOptional: false,
      validator: this.validator ? this.#handleValidation.bind(this) : undefined,
    })
  }

  async #handleValidation(
    returnValue: MaybeMultipleComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    // These should be caught already, primarily here for types
    if (returnValue === undefined) {
      return 'This field is required.'
    }

    if (Array.isArray(returnValue)) {
      return 'This field accepts only one value.'
    }

    if (this.validator) {
      return this.validator(this.getValue(returnValue))
    }
  }

  validate(validator: IOPromiseValidator<Output>): this {
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

export type IOPromiseValidator<Output> = (
  returnValue: Output
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

  #continueButtonConfig: ButtonConfig | undefined

  constructor(config: {
    promises: IOPromises
    renderer: ComponentsRenderer
    continueButton?: ButtonConfig
  }) {
    this.promises = config.promises
    this.#renderer = config.renderer
    this.#continueButtonConfig = config.continueButton
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

    this.#renderer(
      promiseValues.map(p => p.component) as unknown as [
        AnyIOComponent,
        ...AnyIOComponent[]
      ],
      this.#validator ? this.#handleValidation.bind(this) : undefined,
      this.#continueButtonConfig
    )
      .then(values => {
        let returnValues = values.map((val, i) =>
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

    const values = returnValues.map((v, index) =>
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
}
