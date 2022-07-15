import {
  T_IO_DISPLAY_METHOD_NAMES,
  T_IO_INPUT_METHOD_NAMES,
  T_IO_METHOD_NAMES,
  T_IO_PROPS,
  T_IO_STATE,
} from '../ioSchema'
import IOComponent, {
  AnyIOComponent,
  ComponentReturnValue,
} from './IOComponent'
import IOError from './IOError'
import {
  ComponentRenderer,
  ComponentsRenderer,
  GroupIOPromise,
  MaybeOptionalGroupIOPromise,
  OptionalGroupIOPromise,
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
  Props = T_IO_PROPS<MethodName>,
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
        resolve(this.getValue(result))
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
    return new IOComponent(
      this.methodName,
      this.label,
      this.props,
      this.onStateChange,
      false
    )
  }
}

/**
 * A thin subtype of IOPromise that does nothing but mark the component
 * as "display" for display-only components.
 */
export class DisplayIOPromise<
  MethodName extends T_IO_DISPLAY_METHOD_NAMES,
  Props = T_IO_PROPS<MethodName>,
  Output = ComponentReturnValue<MethodName>
> extends IOPromise<MethodName, Props, Output> {}

export class InputIOPromise<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props = T_IO_PROPS<MethodName>,
  Output = ComponentReturnValue<MethodName>
> extends IOPromise<MethodName, Props, Output> {
  get component() {
    return new IOComponent(
      this.methodName,
      this.label,
      this.props,
      this.onStateChange,
      false,
      this.validator ? this.#handleValidation.bind(this) : undefined
    )
  }

  async #handleValidation(
    returnValue: ComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    if (returnValue === undefined) {
      // This should be caught already, primarily here for types
      return 'This field is required.'
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

  exclusive(): ExclusiveIOPromise<MethodName, Props, Output> {
    return new ExclusiveIOPromise({
      renderer: this.renderer,
      methodName: this.methodName,
      label: this.label,
      props: this.props,
      valueGetter: this.valueGetter,
      onStateChange: this.onStateChange,
    })
  }
}

/**
 * A thin subclass of IOPromise that marks its inner component as
 * "optional" and returns `undefined` if not provided by the action runner.
 */
export class OptionalIOPromise<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props = T_IO_PROPS<MethodName>,
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
    return new IOComponent(
      this.methodName,
      this.label,
      this.props,
      this.onStateChange,
      true,
      this.validator ? this.#handleValidation.bind(this) : undefined
    )
  }

  async #handleValidation(
    returnValue: ComponentReturnValue<MethodName> | undefined
  ): Promise<string | undefined> {
    if (this.validator) {
      return this.validator(this.getValue(returnValue))
    }
  }

  getValue(
    result: ComponentReturnValue<MethodName> | undefined
  ): Output | undefined {
    if (result === undefined) return undefined

    if (this.valueGetter) return this.valueGetter(result)

    return result as unknown as Output
  }
}

/**
 * A thin subclass of IOPromise that does nothing but mark the component
 * as "exclusive" for components that cannot be rendered in a group.
 */
export class ExclusiveIOPromise<
  MethodName extends T_IO_INPUT_METHOD_NAMES,
  Props = T_IO_PROPS<MethodName>,
  Output = ComponentReturnValue<MethodName>
> extends InputIOPromise<MethodName, Props, Output> {}

export type IOGroupReturnValues<
  IOPromises extends [
    MaybeOptionalGroupIOPromise,
    ...MaybeOptionalGroupIOPromise[]
  ]
> = {
  [Idx in keyof IOPromises]: IOPromises[Idx] extends GroupIOPromise
    ? ReturnType<IOPromises[Idx]['getValue']>
    : IOPromises[Idx] extends OptionalGroupIOPromise
    ? ReturnType<IOPromises[Idx]['getValue']>
    : IOPromises[Idx]
}

export type IOGroupComponents<
  IOPromises extends [
    MaybeOptionalGroupIOPromise,
    ...MaybeOptionalGroupIOPromise[]
  ]
> = {
  [Idx in keyof IOPromises]: IOPromises[Idx] extends GroupIOPromise
    ? IOPromises[Idx]['component']
    : IOPromises[Idx] extends OptionalGroupIOPromise
    ? IOPromises[Idx]['component']
    : IOPromises[Idx]
}

export type IOPromiseValidator<ReturnValue> = (
  returnValue: ReturnValue
) => string | undefined | Promise<string | undefined>

export class IOGroupPromise<
  IOPromises extends MaybeOptionalGroupIOPromise[],
  ReturnValues = IOPromises extends [
    MaybeOptionalGroupIOPromise,
    ...MaybeOptionalGroupIOPromise[]
  ]
    ? IOGroupReturnValues<IOPromises>
    : unknown[]
> {
  promises: IOPromises
  #renderer: ComponentsRenderer
  #validator: IOPromiseValidator<ReturnValues> | undefined

  constructor(config: { promises: IOPromises; renderer: ComponentsRenderer }) {
    this.promises = config.promises
    this.#renderer = config.renderer
  }

  then(
    resolve: (output: ReturnValues) => void,
    reject?: (err: IOError) => void
  ) {
    this.#renderer(
      this.promises.map(p => p.component) as unknown as [
        AnyIOComponent,
        ...AnyIOComponent[]
      ],
      this.#validator ? this.#handleValidation.bind(this) : undefined
    )
      .then(values => {
        resolve(
          values.map((val, i) =>
            this.promises[i].getValue(val as never)
          ) as unknown as ReturnValues
        )
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

    const values = returnValues.map((v, index) =>
      this.promises[index].getValue(v as never)
    ) as unknown as ReturnValues
    return this.#validator(values)
  }
}
