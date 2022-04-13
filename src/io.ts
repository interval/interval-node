import { v4 } from 'uuid'
import { z } from 'zod'
import type { Logger } from '.'
import type {
  T_IO_RENDER_INPUT,
  T_IO_RESPONSE,
  T_IO_PROPS,
  T_IO_RETURNS,
  T_IO_METHOD_NAMES,
} from './ioSchema'
import { AnyIOComponent } from './component'
import spreadsheet from './components/spreadsheet'
import { selectTable, displayTable } from './components/table'
import findAndSelectUser from './components/selectUser'
import findAndSelect, { selectSingle } from './components/selectSingle'
import selectMultiple from './components/selectMultiple'
import { date, datetime } from './components/inputDate'
import {
  IORenderSender,
  ResponseHandlerFn,
  IOError,
  MaybeOptionalGroupIOPromise,
  GroupIOPromise,
  OptionalGroupIOPromise,
  IOComponentFunction,
  ExclusiveIOComponentFunction,
  ComponentRenderer,
  IOComponentDefinition,
} from './types'
import { IOPromise, ExclusiveIOPromise } from './IOPromise'

interface ClientConfig {
  logger: Logger
  send: IORenderSender
}

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
    Components extends Readonly<[AnyIOComponent, ...AnyIOComponent[]]>
  >(components: Components) {
    if (this.isCanceled) {
      // Transaction is already canceled, host attempted more IO calls
      throw new IOError('TRANSACTION_CLOSED')
    }

    type ReturnValues = {
      -readonly [Idx in keyof Components]: Components[Idx] extends AnyIOComponent
        ? z.infer<Components[Idx]['schema']['returns']> | undefined
        : Components[Idx]
    }

    return new Promise<ReturnValues>(async (resolve, reject) => {
      const inputGroupKey = v4()
      let isReturned = false

      const render = async () => {
        const packed: T_IO_RENDER_INPUT = {
          id: v4(),
          inputGroupKey,
          toRender: components.map(c => c.getRenderInfo()),
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

        if (result.kind === 'RETURN') {
          isReturned = true

          result.values.map((v, index) =>
            // @ts-ignore
            components[index].setReturnValue(v)
          )

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
      )) as unknown as Promise<ReturnValues>

      resolve(response)
    })
  }

  /**
   * A thin wrapper around `renderComponents` that converts IOPromises into
   * their inner components, sends those components through `renderComponents`,
   * and transforms the response sent over the wire to the final return types
   * for each given component using the corresponding IOPromise's `getValue`
   * method.
   */
  async group<
    IOPromises extends Readonly<
      [MaybeOptionalGroupIOPromise, ...MaybeOptionalGroupIOPromise[]]
    >,
    Components extends Readonly<[AnyIOComponent, ...AnyIOComponent[]]>
  >(ioPromises: IOPromises) {
    const components = ioPromises.map(pi => {
      // In case user is using JavaScript or ignores the type error
      if (pi instanceof ExclusiveIOPromise) {
        this.logger.warn(
          '[Interval]',
          `Component with label "${pi.component.label}" is not supported inside a group, please remove it from the group`
        )
      }
      return pi.component
    }) as unknown as Components

    type ReturnValues = {
      -readonly [Idx in keyof IOPromises]: IOPromises[Idx] extends GroupIOPromise
        ? ReturnType<IOPromises[Idx]['getValue']>
        : IOPromises[Idx] extends OptionalGroupIOPromise
        ? ReturnType<IOPromises[Idx]['getValue']>
        : IOPromises[Idx]
    }

    return this.renderComponents(components).then(values =>
      values.map((val, i) => ioPromises[i].getValue(val as never))
    ) as unknown as ReturnValues
  }

  createIOMethod<
    MethodName extends T_IO_METHOD_NAMES,
    Props extends object,
    Output = T_IO_RETURNS<MethodName>
  >(
    methodName: MethodName,
    componentDef?: IOComponentDefinition<MethodName, Props, Output>
  ): IOComponentFunction<MethodName, Props, Output> {
    return (label: string, props?: Props) => {
      let internalProps = props ? (props as T_IO_PROPS<MethodName>) : {}
      let getValue = (r: T_IO_RETURNS<MethodName>) => r as unknown as Output
      let onStateChange: ReturnType<
        IOComponentDefinition<MethodName, Props, Output>
      >['onStateChange'] = undefined

      if (componentDef && props) {
        const componentGetters = componentDef(props)

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

      return new IOPromise<MethodName, T_IO_PROPS<MethodName>, Output>({
        methodName,
        renderer: this.renderComponents.bind(
          this
        ) as ComponentRenderer<MethodName>,
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
  makeExclusive<MethodName extends T_IO_METHOD_NAMES, Props, Output>(
    inner: IOComponentFunction<MethodName, Props, Output>
  ): ExclusiveIOComponentFunction<MethodName, Props, Output> {
    return (label: string, props?: Props) => {
      return new ExclusiveIOPromise(inner(label, props))
    }
  }

  /**
   * The namespace of IO functions available in action handlers.
   */
  get io() {
    return {
      group: this.group.bind(this),

      confirm: this.makeExclusive(this.createIOMethod('CONFIRM')),

      input: {
        text: this.createIOMethod('INPUT_TEXT'),
        boolean: this.createIOMethod('INPUT_BOOLEAN'),
        number: this.createIOMethod('INPUT_NUMBER'),
        email: this.createIOMethod('INPUT_EMAIL'),
        richText: this.createIOMethod('INPUT_RICH_TEXT'),
      },
      select: {
        single: this.createIOMethod('SELECT_SINGLE', selectSingle),
        multiple: this.createIOMethod('SELECT_MULTIPLE', selectMultiple),
        table: this.createIOMethod('SELECT_TABLE', selectTable),
      },
      display: {
        heading: this.createIOMethod('DISPLAY_HEADING'),
        markdown: this.createIOMethod('DISPLAY_MARKDOWN'),
        link: this.createIOMethod('DISPLAY_LINK'),
        object: this.createIOMethod('DISPLAY_OBJECT'),
        table: this.createIOMethod('DISPLAY_TABLE', displayTable),
      },
      experimental: {
        spreadsheet: this.createIOMethod('INPUT_SPREADSHEET', spreadsheet),
        findAndSelectUser: this.createIOMethod(
          'SELECT_USER',
          findAndSelectUser
        ),
        findAndSelect: this.createIOMethod('SELECT_SINGLE', findAndSelect),
        date: this.createIOMethod('INPUT_DATE', date),
        time: this.createIOMethod('INPUT_TIME'),
        datetime: this.createIOMethod('INPUT_DATETIME', datetime),
        progress: {
          steps: this.createIOMethod('DISPLAY_PROGRESS_STEPS'),
          indeterminate: this.createIOMethod('DISPLAY_PROGRESS_INDETERMINATE'),
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
