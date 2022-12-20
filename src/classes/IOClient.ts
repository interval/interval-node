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
import displayTable from '../components/displayTable'
import selectTable from '../components/selectTable'
import selectSingle from '../components/selectSingle'
import search from '../components/search'
import selectMultiple from '../components/selectMultiple'
import displayGrid from '../components/displayGrid'
import displayLink from '../components/displayLink'
import displayImage from '../components/displayImage'
import displayVideo from '../components/displayVideo'
import urlInput from '../components/url'
import { date, datetime } from '../components/inputDate'
import { file } from '../components/upload'
import {
  IORenderSender,
  ResponseHandlerFn,
  MaybeOptionalGroupIOPromise,
  ExclusiveIOComponentFunction,
  ComponentRenderer,
  IOComponentDefinition,
  DisplayIOComponentFunction,
  RequiredPropsDisplayIOComponentFunction,
  InputIOComponentFunction,
  RequiredPropsInputIOComponentFunction,
  GroupConfig,
  ButtonConfig,
} from '../types'
import { stripUndefined } from '../utils/deserialize'
import { IntervalError } from '..'

interface ClientConfig {
  logger: Logger
  send: IORenderSender
  isDemo?: boolean
  // onAddInlineAction: (handler: IntervalActionHandler) => string
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
  isDemo: boolean
  // onAddInlineAction: (handler: IntervalActionHandler) => string

  onResponseHandler: ResponseHandlerFn | undefined
  inlineActionKeys = new Set<string>()
  isCanceled = false

  constructor(config: ClientConfig) {
    this.logger = config.logger
    this.send = config.send
    this.isDemo = !!config.isDemo
    // this.onAddInlineAction = config.onAddInlineAction
  }

  // addInlineAction(handler: IntervalActionHandler): string {
  //   const key = this.onAddInlineAction(handler)
  //   this.inlineActionKeys.add(key)
  //   return key
  // }

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
    groupValidator?: IOClientRenderValidator<Components>,
    continueButton?: ButtonConfig
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
            continueButton,
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

            validationErrorMessage = undefined

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
    IOPromises extends
      | [MaybeOptionalGroupIOPromise, ...MaybeOptionalGroupIOPromise[]]
      | Record<string, MaybeOptionalGroupIOPromise>
      | MaybeOptionalGroupIOPromise[]
  >(promises: IOPromises, props?: GroupConfig) {
    const promiseValues = Array.isArray(promises)
      ? promises
      : Object.values(promises)

    const exclusivePromises = promiseValues.filter(
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
      continueButton: props?.continueButton,
    })
  }

  getPromiseProps<
    MethodName extends T_IO_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    inputProps?: Props,
    componentDef?: IOComponentDefinition<MethodName, Props, Output>
  ) {
    let props = inputProps ? (inputProps as T_IO_PROPS<MethodName>) : {}
    let getValue = (r: T_IO_RETURNS<MethodName>) => r as unknown as Output
    let onStateChange: ReturnType<
      IOComponentDefinition<MethodName, Props, Output>
    >['onStateChange'] = undefined

    if (componentDef) {
      const componentGetters = componentDef.bind(this)(
        inputProps ?? ({} as Props)
      )

      if (componentGetters.props) {
        props = componentGetters.props
      }

      if (componentGetters.getValue) {
        getValue = componentGetters.getValue
      }

      if (componentGetters.onStateChange) {
        onStateChange = componentGetters.onStateChange
      }
    }

    return {
      methodName,
      props,
      valueGetter: getValue,
      onStateChange,
    }
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
      const isDisplay = methodName.startsWith('DISPLAY_')
      const promiseProps = this.getPromiseProps(methodName, props, componentDef)

      return isDisplay
        ? new DisplayIOPromise({
            ...promiseProps,
            methodName: methodName as T_IO_DISPLAY_METHOD_NAMES,
            renderer: this.renderComponents.bind(
              this
            ) as ComponentRenderer<T_IO_DISPLAY_METHOD_NAMES>,
            label,
          })
        : new InputIOPromise({
            ...promiseProps,
            methodName: methodName as T_IO_INPUT_METHOD_NAMES,
            renderer: this.renderComponents.bind(
              this
            ) as ComponentRenderer<T_IO_INPUT_METHOD_NAMES>,
            label,
          })
    }
  }

  createExclusiveIOMethod<
    MethodName extends T_IO_INPUT_METHOD_NAMES,
    Props extends object = T_IO_PROPS<MethodName>,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    {
      componentDef,
      demoUnsupported = false,
    }: {
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
      demoUnsupported?: boolean
    } = {}
  ): ExclusiveIOComponentFunction<MethodName, Props, Output> {
    return (label: string, props?: Props) => {
      if (demoUnsupported && this.isDemo) {
        throw new IntervalError(
          `The ${methodName} method isn't supported in demo mode`
        )
      }
      const promiseProps = this.getPromiseProps(methodName, props, componentDef)
      return new ExclusiveIOPromise({
        ...promiseProps,
        methodName,
        renderer: this.renderComponents.bind(
          this
        ) as ComponentRenderer<MethodName>,
        label,
      })
    }
  }

  /**
   * The namespace of IO functions available in action handlers.
   */
  get io() {
    return {
      group: this.group.bind(this),

      confirm: this.createExclusiveIOMethod('CONFIRM'),
      confirmIdentity: this.createExclusiveIOMethod('CONFIRM_IDENTITY', {
        demoUnsupported: true,
      }),
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
        url: this.createIOMethod('INPUT_URL', {
          componentDef: urlInput,
        }),
        date: this.createIOMethod('INPUT_DATE', { componentDef: date }),
        time: this.createIOMethod('INPUT_TIME'),
        datetime: this.createIOMethod('INPUT_DATETIME', {
          componentDef: datetime,
        }),
        file: this.createIOMethod('UPLOAD_FILE', {
          componentDef: file(this.logger),
        }),
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
        code: this.createIOMethod('DISPLAY_CODE', {
          propsRequired: true,
        }),
        heading: this.createIOMethod('DISPLAY_HEADING'),
        markdown: this.createIOMethod('DISPLAY_MARKDOWN'),
        image: this.createIOMethod('DISPLAY_IMAGE', {
          componentDef: displayImage,
          propsRequired: true,
        }),
        metadata: this.createIOMethod('DISPLAY_METADATA', {
          propsRequired: true,
        }),
        link: this.createIOMethod('DISPLAY_LINK', {
          componentDef: displayLink,
          propsRequired: true,
        }),
        object: this.createIOMethod('DISPLAY_OBJECT', {
          propsRequired: true,
        }),
        table: this.createIOMethod('DISPLAY_TABLE', {
          propsRequired: true,
          componentDef: displayTable(this.logger),
        }),
        grid: this.createIOMethod('DISPLAY_GRID', {
          propsRequired: true,
          componentDef: displayGrid(),
        }),
        video: this.createIOMethod('DISPLAY_VIDEO', {
          componentDef: displayVideo,
          propsRequired: true,
        }),
      },
      experimental: {
        spreadsheet: this.createIOMethod('INPUT_SPREADSHEET', {
          propsRequired: true,
          componentDef: spreadsheet,
        }),
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
