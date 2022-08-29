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
  DisplayComponentToRender,
} from '../ioSchema'
import Logger from './Logger'
import { AnyDisplayComponent, AnyIOComponent } from './IOComponent'
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
} from '../types'
import { stripUndefined } from '../utils/deserialize'
import { IntervalError } from '..'

interface ClientConfig {
  logger: Logger
  send: (children: DisplayComponentToRender) => Promise<void>
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
export class PageDisplayClient {
  logger: Logger
  send: (children: DisplayComponentToRender) => Promise<void>

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
    Components extends [AnyDisplayComponent, ...AnyDisplayComponent[]]
  >(components: Components) {
    return new Promise<IOClientRenderReturnValues<Components>>(
      async resolve => {
        const inputGroupKey = v4()

        const render = async () => {
          const children = components
            .map(c => c.getRenderInfo())
            .map(({ props, ...renderInfo }) => {
              const { json, meta } = superjson.serialize(stripUndefined(props))
              return {
                ...renderInfo,
                props: json,
                propsMeta: meta,
              }
            })

          // await this.send(children)
        }

        this.onResponseHandler = async result => {
          if (result.inputGroupKey && result.inputGroupKey !== inputGroupKey) {
            this.logger.debug('Received response for other input group')
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
      const componentGetters = componentDef(inputProps ?? ({} as Props))

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
    MethodName extends T_IO_DISPLAY_METHOD_NAMES,
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
      const promiseProps = this.getPromiseProps(methodName, props, componentDef)

      // return new DisplayIOPromise({
      //       ...promiseProps,
      //       methodName,
      //       renderer: this.renderComponents.bind(
      //         this
      //       ),
      //       label,
      //     })
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
    }: {
      componentDef?: IOComponentDefinition<MethodName, Props, Output>
    } = {}
  ): ExclusiveIOComponentFunction<MethodName, Props, Output> {
    return (label: string, props?: Props) => {
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
  get display() {
    return {
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
