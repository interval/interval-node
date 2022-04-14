import { T_IO_METHOD_NAMES, T_IO_PROPS, T_IO_STATE } from '../ioSchema'
import IOComponent, { ComponentReturnValue } from './IOComponent'
import { IOError, ComponentRenderer } from '../types'

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
  methodName: MethodName
  renderer: ComponentRenderer<MethodName>
  label: string
  props: Props
  valueGetter:
    | ((response: ComponentReturnValue<MethodName>) => Output)
    | undefined
  onStateChange:
    | ((incomingState: T_IO_STATE<MethodName>) => Promise<Partial<Props>>)
    | undefined

  constructor({
    renderer,
    methodName,
    label,
    props,
    valueGetter,
    onStateChange,
  }: {
    renderer: ComponentRenderer<MethodName>
    methodName: MethodName
    label: string
    props: Props
    valueGetter?: (response: ComponentReturnValue<MethodName>) => Output
    onStateChange?: (
      incomingState: T_IO_STATE<MethodName>
    ) => Promise<Partial<Props>>
  }) {
    this.renderer = renderer
    this.methodName = methodName
    this.label = label
    this.props = props
    this.valueGetter = valueGetter
    this.onStateChange = onStateChange
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
      this.onStateChange
    )
  }

  optional(): OptionalIOPromise<MethodName, Props, Output> {
    return new OptionalIOPromise(this)
  }
}

/**
 * A thin subclass of IOPromise that marks its inner component as
 * "optional" and returns `undefined` if not provided by the action runner.
 */
export class OptionalIOPromise<
  MethodName extends T_IO_METHOD_NAMES,
  Props = T_IO_PROPS<MethodName>,
  Output = ComponentReturnValue<MethodName>
> extends IOPromise<MethodName, Props, Output | undefined> {
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
      true
    )
  }

  getValue(
    result: ComponentReturnValue<MethodName> | undefined
  ): Output | undefined {
    if (result === undefined) return undefined

    return result as unknown as Output
  }
}

/**
 * A thin subclass of IOPromise that does nothing but mark the component
 * as "exclusive" for components that cannot be rendered in a group.
 */
export class ExclusiveIOPromise<
  MethodName extends T_IO_METHOD_NAMES,
  Props = T_IO_PROPS<MethodName>,
  Output = ComponentReturnValue<MethodName>
> extends IOPromise<MethodName, Props, Output> {}
