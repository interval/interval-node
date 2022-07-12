import { v4 } from 'uuid'
import { z } from 'zod'
import * as superjson from 'superjson'
import type {
  T_IO_RENDER_INPUT,
  T_IO_RESPONSE,
  T_IO_PROPS,
  T_IO_RETURNS,
  T_IO_METHOD_NAMES,
  T_IO_DISPLAY_METHOD_NAMES,
  T_IO_INPUT_METHOD_NAMES,
} from '../ioSchema'
import Logger from './Logger'
import { AnyIOComponent } from './IOComponent'
import {
  ExclusiveIOPromise,
  IOGroupPromise,
  IOPromiseValidator,
  DisplayIOPromise,
  InputIOPromise,
} from './IOPromise'
import IOError from './IOError'
import spreadsheet from '../components/spreadsheet'
import { selectTable, displayTable } from '../components/table'
import selectSingle from '../components/selectSingle'
import search from '../components/search'
import selectMultiple from '../components/selectMultiple'
import displayLink from '../components/displayLink'
import { date, datetime } from '../components/inputDate'
import { file } from '../components/upload'
import {
  IORenderSender,
  ResponseHandlerFn,
  MaybeOptionalGroupIOPromise,
  ExclusiveIOComponentFunction,
  ComponentRenderer,
  IOComponentDefinition,
  RequiredPropsExclusiveIOComponentFunction,
  DisplayIOComponentFunction,
  RequiredPropsDisplayIOComponentFunction,
  InputIOComponentFunction,
  RequiredPropsInputIOComponentFunction,
} from '../types'
import { stripUndefined } from '../utils/deserialize'
import { IntervalError } from '..'

interface ClientConfig {
  logger: Logger
  send: IORenderSender
}

export type IOClientRenderReturnValues<
  Components extends [AnyIOComponent, ...AnyIOComponent[]]
> = {
  [Idx in keyof Components]: Components[Idx] extends AnyIOComponent
    ? z.infer<Components[Idx]['schema']['returns']> | undefined
    : Components[Idx]
}

export type IOClientRenderValidator<
  Components extends [AnyIOComponent, ...AnyIOComponent[]]
> = IOPromiseValidator<IOClientRenderReturnValues<Components>>

/**
 * The client class that handles IO calls for a given transaction.
 *
 * Each transaction has its own IOClient which creates the IO argument
 * passed to action handlers that are aware of the transaction in order
 * to transmit IO calls correctly.
 */
export class IOClient {
  logger: Logger
  send: IORenderSender

  onResponseHandler: ResponseHandlerFn | undefined
  isCanceled = false

  constructor({ logger, send }: ClientConfig) {
    this.logger = logger
    this.send = send
  }

  /**
   * Creates a render loop for an IO call.
   *
   * Given a list of components (potentially only one if not rendering a group)
   * this method is responsible for sending the initial render call and handling
   * responses (returns, state updates, or cancellations) from Interval.
   * Resolves when it receives final responses or from Interval,
   * or throws an IOError of kind `CANCELED` if canceled.
   */
  async renderComponents<
    Components extends [AnyIOComponent, ...AnyIOComponent[]]
  >(
    components: Components,
    groupValidator?: IOClientRenderValidator<Components>
  ) {
    if (this.isCanceled) {
      // Transaction is already canceled, host attempted more IO calls
      throw new IOError('TRANSACTION_CLOSED')
    }

    let validationErrorMessage: string | undefined

    return new Promise<IOClientRenderReturnValues<Components>>(
      async (resolve, reject) => {
        const inputGroupKey = v4()
        let isReturned = false

        const render = async () => {
          const packed: T_IO_RENDER_INPUT = {
            id: v4(),
            inputGroupKey,
            toRender: components
              .map(c => c.getRenderInfo())
              .map(({ props, ...renderInfo }) => {
                const { json, meta } = superjson.serialize(
                  stripUndefined(props)
                )
                return {
                  ...renderInfo,
                  props: json,
                  propsMeta: meta,
                }
              }),
            validationErrorMessage,
            kind: 'RENDER',
          }

          await this.send(packed)
        }

        this.onResponseHandler = async result => {
          if (result.inputGroupKey && result.inputGroupKey !== inputGroupKey) {
            this.logger.debug('Received response for other input group')
            return
          }

          if (this.isCanceled || isReturned) {
            this.logger.debug('Received response after IO call complete')
            return
          }

          // Transaction canceled from Interval cloud UI
          if (result.kind === 'CANCELED') {
            this.isCanceled = true
            reject(new IOError('CANCELED'))
            return
          }

          if (result.values.length !== components.length) {
            throw new Error('Mismatch in return array length')
          }

          if (result.valuesMeta) {
            result.values = superjson.deserialize({
              json: result.values,
              meta: result.valuesMeta,
            })
          }

          if (result.kind === 'RETURN') {
            const validities = await Promise.all(
              result.values.map(async (v, index) => {
                const component = components[index]
                if (component.validator) {
                  const resp = await component.handleValidation(v)
                  if (resp !== undefined) {
                    return false
                  }
                }
                return true
              })
            )

            if (validities.some(v => !v)) {
              render()
              return
            }

            if (groupValidator) {
              validationErrorMessage = await groupValidator(
                result.values as IOClientRenderReturnValues<typeof components>
              )

              if (validationErrorMessage) {
                render()
                return
              }
            }

            isReturned = true

            result.values.forEach((v, index) => {
              // @ts-ignore
              components[index].setReturnValue(v)
            })

            return
          }

          if (result.kind === 'SET_STATE') {
            for (const [index, newState] of result.values.entries()) {
              const prevState = components[index].getInstance().state

              if (JSON.stringify(newState) !== JSON.stringify(prevState)) {
                this.logger.debug(`New state at ${index}`, newState)
                // @ts-ignore
                await components[index].setState(newState)
              }
            }
            render()
          }
        }

        for (const c of components) {
          // every time any component changes their state, we call render (again)
          c.onStateChange(render)
        }

        // Initial render
        render()

        const response = (await Promise.all(
          components.map(comp => comp.returnValue)
        )) as unknown as Promise<IOClientRenderReturnValues<Components>>

        resolve(response)
      }
    )
  }

  /**
   * A thin wrapper around `renderComponents` that converts IOPromises into
   * their inner components, sends those components through `renderComponents`,
   * and transforms the response sent over the wire to the final return types
   * for each given component using the corresponding IOPromise's `getValue`
   * method.
   */
  group<
    IOPromises extends [
      MaybeOptionalGroupIOPromise,
      ...MaybeOptionalGroupIOPromise[]
    ]
  >(ioPromises: IOPromises): IOGroupPromise<IOPromises>
  group(
    ioPromises: MaybeOptionalGroupIOPromise[]
  ): IOGroupPromise<MaybeOptionalGroupIOPromise[]>
  group<
    IOPromises extends [
      MaybeOptionalGroupIOPromise,
      ...MaybeOptionalGroupIOPromise[]
    ]
  >(promises: IOPromises) {
    const exclusivePromises = promises.filter(
      pi => pi instanceof ExclusiveIOPromise
    )

    if (exclusivePromises.length > 0) {
      throw new IntervalError(
        `Components with the following labels are not supported inside groups, please remove them from the group: ${exclusivePromises
          .map(pi => pi.component.label)
          .join(', ')}`
      )
    }

    return new IOGroupPromise({
      promises,
      renderer: this.renderComponents.bind(this),
    })
  }

  createIOMethod<
    MethodName extends T_IO_DISPLAY_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    config?: {
      propsRequired?: false
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    }
  ): DisplayIOComponentFunction<MethodName, Props, Output>
  createIOMethod<
    MethodName extends T_IO_DISPLAY_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    config: {
      propsRequired?: true
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    }
  ): RequiredPropsDisplayIOComponentFunction<MethodName, Props, Output>
  createIOMethod<
    MethodName extends T_IO_INPUT_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    config?: {
      propsRequired?: false
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    }
  ): InputIOComponentFunction<MethodName, Props, Output>
  createIOMethod<
    MethodName extends T_IO_INPUT_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    config: {
      propsRequired?: true
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    }
  ): RequiredPropsInputIOComponentFunction<MethodName, Props, Output>
  createIOMethod<
    MethodName extends T_IO_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    {
      componentDef,
    }: {
      propsRequired?: boolean
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    } = {}
  ) {
    return (label: string, props?: Props) => {
      let internalProps = props ? (props as T_IO_PROPS<MethodName>) : {}
      let getValue = (r: T_IO_RETURNS<MethodName>) => r as unknown as Output
      let onStateChange: ReturnType<
        IOComponentDefinition<MethodName, Props, Output>
      >['onStateChange'] = undefined

      if (componentDef) {
        const componentGetters = componentDef(props ?? ({} as Props))

        if (componentGetters.props) {
          internalProps = componentGetters.props
        }

        if (componentGetters.getValue) {
          getValue = componentGetters.getValue
        }

        if (componentGetters.onStateChange) {
          onStateChange = componentGetters.onStateChange
        }
      }

      const isDisplay = methodName.startsWith('DISPLAY_')

      return isDisplay
        ? new DisplayIOPromise({
            methodName: methodName as T_IO_DISPLAY_METHOD_NAMES,
            renderer: this.renderComponents.bind(
              this
            ) as ComponentRenderer<T_IO_DISPLAY_METHOD_NAMES>,
            label,
            props: internalProps,
            valueGetter: getValue,
            onStateChange,
          })
        : new InputIOPromise({
            methodName: methodName as T_IO_INPUT_METHOD_NAMES,
            renderer: this.renderComponents.bind(
              this
            ) as ComponentRenderer<T_IO_INPUT_METHOD_NAMES>,
            label,
            props: internalProps,
            valueGetter: getValue,
            onStateChange,
          })
    }
  }

  /**
   * A very thin wrapper function that converts an IOPromise to an
   * ExclusiveIOPromise, which cannot be rendered in a group.
   */
  makeExclusive<MethodName extends T_IO_INPUT_METHOD_NAMES, Props, Output>(
    inner: InputIOComponentFunction<MethodName, Props, Output>,
    propsRequired?: false
  ): ExclusiveIOComponentFunction<MethodName, Props, Output>
  makeExclusive<MethodName extends T_IO_INPUT_METHOD_NAMES, Props, Output>(
    inner: InputIOComponentFunction<MethodName, Props, Output>,
    propsRequired?: true
  ): RequiredPropsExclusiveIOComponentFunction<MethodName, Props, Output>
  makeExclusive<MethodName extends T_IO_INPUT_METHOD_NAMES, Props, Output>(
    inner: InputIOComponentFunction<MethodName, Props, Output>,
    _propsRequired = false
  ): ExclusiveIOComponentFunction<MethodName, Props, Output> {
    return (label: string, props?: Props) => {
      return inner(label, props).exclusive()
    }
  }

  /**
   * The namespace of IO functions available in action handlers.
   */
  get io() {
    return {
      group: this.group.bind(this),

      confirm: this.makeExclusive(this.createIOMethod('CONFIRM')),

      search: this.createIOMethod('SEARCH', {
        propsRequired: true,
        componentDef: search,
      }),

      input: {
        text: this.createIOMethod('INPUT_TEXT'),
        boolean: this.createIOMethod('INPUT_BOOLEAN'),
        number: this.createIOMethod('INPUT_NUMBER'),
        email: this.createIOMethod('INPUT_EMAIL'),
        richText: this.createIOMethod('INPUT_RICH_TEXT'),
      },
      select: {
        single: this.createIOMethod('SELECT_SINGLE', {
          propsRequired: true,
          componentDef: selectSingle(this.logger),
        }),
        multiple: this.createIOMethod('SELECT_MULTIPLE', {
          propsRequired: true,
          componentDef: selectMultiple(this.logger),
        }),
        table: this.createIOMethod('SELECT_TABLE', {
          propsRequired: true,
          componentDef: selectTable(this.logger),
        }),
      },
      display: {
        heading: this.createIOMethod('DISPLAY_HEADING'),
        markdown: this.createIOMethod('DISPLAY_MARKDOWN'),
        link: this.createIOMethod('DISPLAY_LINK', {
          componentDef: displayLink,
        }),
        object: this.createIOMethod('DISPLAY_OBJECT'),
        table: this.createIOMethod('DISPLAY_TABLE', {
          propsRequired: true,
          componentDef: displayTable(this.logger),
        }),
      },
      experimental: {
        spreadsheet: this.createIOMethod('INPUT_SPREADSHEET', {
          propsRequired: true,
          componentDef: spreadsheet,
        }),
        date: this.createIOMethod('INPUT_DATE', { componentDef: date }),
        time: this.createIOMethod('INPUT_TIME'),
        datetime: this.createIOMethod('INPUT_DATETIME', {
          componentDef: datetime,
        }),
        input: {
          file: this.createIOMethod('UPLOAD_FILE', { componentDef: file }),
        },
      },
    }
  }

  onResponse(result: T_IO_RESPONSE) {
    if (this.onResponseHandler) {
      try {
        this.onResponseHandler(result)
      } catch (err) {
        this.logger.error('Error in onResponseHandler:', err)
      }
    }
  }
}
