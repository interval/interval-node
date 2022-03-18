import { v4 } from 'uuid'
import { z } from 'zod'
import type { Logger } from '.'
import type {
  T_IO_RENDER_INPUT,
  T_IO_RESPONSE,
  T_IO_Schema,
  T_IO_METHOD_NAMES,
} from './ioSchema'
import component, {
  AnyComponentType,
  ComponentType,
  ComponentReturnValue,
} from './component'
import progressThroughList from './components/progressThroughList'
import spreadsheet from './components/spreadsheet'
import selectTable from './components/selectTable'
import findAndSelectUser from './components/selectUser'
import findAndSelect, { selectSingle } from './components/selectSingle'
import selectMultiple from './components/selectMultiple'

export type IOPromiseConstructor<
  MethodName extends T_IO_METHOD_NAMES,
  Output extends ComponentReturnValue<MethodName> = ComponentReturnValue<MethodName>
> = (c: ComponentType<MethodName>) => IOPromise<MethodName, Output>

export type IOComponentFunction<
  MethodName extends T_IO_METHOD_NAMES,
  Output extends ComponentReturnValue<MethodName> = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: z.input<T_IO_Schema[MethodName]['props']>
) => IOPromise<MethodName, Output>

export type ExclusiveIOComponentFunction<
  MethodName extends T_IO_METHOD_NAMES,
  Output extends ComponentReturnValue<MethodName> = ComponentReturnValue<MethodName>
> = (
  label: string,
  props?: z.input<T_IO_Schema[MethodName]['props']>
) => ExclusiveIOPromise<MethodName, Output>

export interface IOPromise<
  MethodName extends T_IO_METHOD_NAMES,
  Output extends ComponentReturnValue<MethodName> = ComponentReturnValue<MethodName>
> {
  component: ComponentType<MethodName>
  _output: Output | undefined
  then: Executor<MethodName, Output>
  optional: () => OptionalIOPromise<MethodName, Output>
  // This doesn't actually do anything, we only use it as a marker to provide
  // slightly better error messages to users if they use an exclusive method
  // inside a group.
  groupable: true
}

export interface OptionalIOPromise<
  MethodName extends T_IO_METHOD_NAMES,
  Output extends ComponentReturnValue<MethodName> = ComponentReturnValue<MethodName>
> extends Omit<IOPromise<MethodName, Output>, 'optional' | 'then'> {
  isOptional: true
  then: OptionalExecutor<MethodName, Output>
}

export type ExclusiveIOPromise<
  MethodName extends T_IO_METHOD_NAMES,
  Output extends ComponentReturnValue<MethodName> = ComponentReturnValue<MethodName>
> = Omit<IOPromise<MethodName, Output>, 'groupable'>

interface ClientConfig {
  logger: Logger
  send: (ioToRender: T_IO_RENDER_INPUT) => Promise<void>
}

export type IOErrorKind = 'CANCELED' | 'TRANSACTION_CLOSED'

export class IOError extends Error {
  kind: IOErrorKind

  constructor(kind: IOErrorKind, message?: string) {
    super(message)
    this.kind = kind
  }
}

export type Executor<
  MethodName extends T_IO_METHOD_NAMES,
  Output extends ComponentReturnValue<MethodName> = ComponentReturnValue<MethodName>
> = (resolve: (output: Output) => void, reject?: (err: IOError) => void) => void

export type OptionalExecutor<
  MethodName extends T_IO_METHOD_NAMES,
  Output extends ComponentReturnValue<MethodName> = ComponentReturnValue<MethodName>
> = (
  resolve: (output: Output | undefined) => void,
  reject?: (err: IOError) => void
) => void

export type IOPromiseMap = {
  [MethodName in T_IO_METHOD_NAMES]: IOPromise<MethodName>
}
export type AnyIOPromise = IOPromiseMap[T_IO_METHOD_NAMES]

/**
 * Map of IOPromises that can be rendered in a group.
 */
type GroupIOPromiseMap = {
  [MethodName in T_IO_METHOD_NAMES]: T_IO_Schema[MethodName] extends {
    exclusive: z.ZodLiteral<true>
  }
    ? never
    : IOPromise<MethodName>
}
type GroupIOPromise = GroupIOPromiseMap[T_IO_METHOD_NAMES]

type OptionalGroupIOPromiseMap = {
  [MethodName in T_IO_METHOD_NAMES]: T_IO_Schema[MethodName] extends {
    exclusive: z.ZodLiteral<true>
  }
    ? never
    : OptionalIOPromise<MethodName>
}
type OptionalGroupIOPromise = OptionalGroupIOPromiseMap[T_IO_METHOD_NAMES]

type MaybeOptionalGroupIOPromise = GroupIOPromise | OptionalGroupIOPromise

export default function createIOClient(clientConfig: ClientConfig) {
  type ResponseHandlerFn = (fn: T_IO_RESPONSE) => void
  let onResponseHandler: ResponseHandlerFn | null = null
  let isCanceled = false

  async function renderComponents<
    Instances extends Readonly<[AnyComponentType, ...AnyComponentType[]]>
  >(componentInstances: Instances) {
    if (isCanceled) {
      // Transaction is already canceled, host attempted more IO calls
      throw new IOError('TRANSACTION_CLOSED')
    }

    type ReturnValues = {
      -readonly [Idx in keyof Instances]: Instances[Idx] extends AnyComponentType
        ? z.infer<Instances[Idx]['schema']['returns']> | undefined
        : Instances[Idx]
    }

    return new Promise<ReturnValues>(async (resolve, reject) => {
      const inputGroupKey = v4()

      async function render() {
        const packed: T_IO_RENDER_INPUT = {
          id: v4(),
          inputGroupKey: inputGroupKey,
          toRender: componentInstances.map(inst => inst.getRenderInfo()),
          kind: 'RENDER',
        }

        await clientConfig.send(packed)
      }

      onResponseHandler = async result => {
        // Transaction canceled from Interval cloud UI
        if (result.kind === 'CANCELED') {
          isCanceled = true
          reject(new IOError('CANCELED'))
          return
        }

        if (result.values.length !== componentInstances.length) {
          throw new Error('Mismatch in return array length')
        }

        if (result.kind === 'RETURN') {
          result.values.map((v, index) =>
            // @ts-ignore
            componentInstances[index].setReturnValue(v)
          )

          return
        }

        if (result.kind === 'SET_STATE') {
          for (const [index, newState] of result.values.entries()) {
            const prevState = componentInstances[index].getInstance().state

            if (JSON.stringify(newState) !== JSON.stringify(prevState)) {
              console.log(`New state at ${index}`, newState)
              // @ts-ignore
              await componentInstances[index].setState(newState)
            }
          }
          render()
        }
      }

      for (const c of componentInstances) {
        // every time any component changes their state, we call render (again)
        c.onStateChange(render)
      }

      // Initial render
      render()

      const response = (await Promise.all(
        componentInstances.map(comp => comp.returnValue)
      )) as unknown as Promise<ReturnValues>

      resolve(response)
    })
  }

  async function group<
    PromiseInstances extends Readonly<
      [MaybeOptionalGroupIOPromise, ...MaybeOptionalGroupIOPromise[]]
    >,
    ComponentInstances extends Readonly<
      [AnyComponentType, ...AnyComponentType[]]
    >
  >(promiseInstances: PromiseInstances) {
    const componentInstances = promiseInstances.map(pi => {
      // In case user is using JavaScript or ignores the type error
      if (!pi.groupable) {
        clientConfig.logger.warn(
          '[Interval]',
          `Component with label "${pi.component.label}" is not supported inside a group, please remove it from the group`
        )
      }
      return pi.component
    }) as unknown as ComponentInstances

    type ReturnValues = {
      -readonly [Idx in keyof PromiseInstances]: PromiseInstances[Idx] extends GroupIOPromise
        ? NonNullable<PromiseInstances[Idx]['_output']>
        : PromiseInstances[Idx] extends OptionalGroupIOPromise
        ? PromiseInstances[Idx]['_output']
        : PromiseInstances[Idx]
    }

    return renderComponents(componentInstances) as unknown as ReturnValues
  }

  function ioPromiseConstructor<
    MethodName extends T_IO_METHOD_NAMES,
    Output extends ComponentReturnValue<MethodName> = ComponentReturnValue<MethodName>
  >(component: ComponentType<MethodName>): IOPromise<MethodName, Output> {
    const _output: Output | undefined = undefined

    return {
      groupable: true,
      component,
      _output,
      optional() {
        const { optional, then, ...rest } = this

        rest.component.setOptional(true)

        return {
          ...rest,
          isOptional: true,
          then(resolve, reject) {
            const componentInstances = [component] as unknown as Readonly<
              [AnyComponentType, ...AnyComponentType[]]
            >

            renderComponents(componentInstances)
              .then(([result]) => {
                resolve(result as typeof _output)
              })
              .catch(err => {
                if (reject) {
                  reject(err)
                }
              })
          },
        }
      },
      then(resolve, reject) {
        const componentInstances = [component] as unknown as Readonly<
          [AnyComponentType, ...AnyComponentType[]]
        >

        renderComponents(componentInstances)
          .then(([result]) => {
            resolve(result as NonNullable<typeof _output>)
          })
          .catch(err => {
            if (reject) {
              reject(err)
            }
          })
      },
    }
  }

  function aliasComponentName<MethodName extends T_IO_METHOD_NAMES>(
    methodName: MethodName
  ): IOComponentFunction<MethodName> {
    return (
      label: string,
      props?: z.input<T_IO_Schema[MethodName]['props']>
    ) => {
      const c = component(methodName, label, props)
      return ioPromiseConstructor(c)
    }
  }

  /**
   * A simple wrapper that strips the marker prop to create
   * a type error if you try to use it in a group.
   */
  function makeExclusive<MethodName extends T_IO_METHOD_NAMES>(
    inner: IOComponentFunction<MethodName>
  ): ExclusiveIOComponentFunction<MethodName> {
    return (
      label: string,
      props?: z.input<T_IO_Schema[MethodName]['props']>
    ) => {
      const { groupable, ...rest } = inner(label, props)
      return rest
    }
  }

  return {
    io: {
      group,

      confirm: makeExclusive(aliasComponentName('CONFIRM')),

      input: {
        text: aliasComponentName('INPUT_TEXT'),
        boolean: aliasComponentName('INPUT_BOOLEAN'),
        number: aliasComponentName('INPUT_NUMBER'),
        email: aliasComponentName('INPUT_EMAIL'),
        richText: aliasComponentName('INPUT_RICH_TEXT'),
      },
      select: {
        single: selectSingle(ioPromiseConstructor),
        multiple: selectMultiple(ioPromiseConstructor),
        table: selectTable(ioPromiseConstructor),
      },
      display: {
        heading: aliasComponentName('DISPLAY_HEADING'),
        markdown: aliasComponentName('DISPLAY_MARKDOWN'),
        object: aliasComponentName('DISPLAY_OBJECT'),
        table: aliasComponentName('DISPLAY_TABLE'),
      },
      experimental: {
        progressThroughList: progressThroughList(ioPromiseConstructor),
        spreadsheet: spreadsheet(ioPromiseConstructor),
        findAndSelectUser: findAndSelectUser(ioPromiseConstructor),
        findAndSelect: findAndSelect(ioPromiseConstructor),
        date: aliasComponentName('INPUT_DATE'),
        time: aliasComponentName('INPUT_TIME'),
        datetime: aliasComponentName('INPUT_DATETIME'),
        progress: {
          steps: aliasComponentName('DISPLAY_PROGRESS_STEPS'),
          indeterminate: aliasComponentName('DISPLAY_PROGRESS_INDETERMINATE'),
        },
      },
    },
    isCanceled: () => isCanceled,
    onResponse: (result: T_IO_RESPONSE) => {
      if (onResponseHandler) {
        try {
          onResponseHandler(result)
        } catch (err) {
          console.error('Error in onResponseHandler:', err)
        }
      }
    },
  }
}

export type IOClient = ReturnType<typeof createIOClient>
