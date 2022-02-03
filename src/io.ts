import { v4 } from 'uuid'
import { z } from 'zod'
import { T_IO_METHOD, T_IO_METHOD_NAMES } from './ioSchema'
import type { T_IO_RENDER, T_IO_RESPONSE } from './ioSchema'
import component, {
  AnyComponentType,
  ComponentType,
  ComponentReturnValue,
} from './component'
import progressThroughList from './components/progressThroughList'
import findAndSelectUser from './components/selectUser'

export type IOPromiseConstructor<MethodName extends T_IO_METHOD_NAMES> = (
  c: ComponentType<MethodName>
) => IOPromise<MethodName>

export interface IOPromise<MethodName extends T_IO_METHOD_NAMES> {
  component: ComponentType<MethodName>
  then: Executor<MethodName>
}

interface ClientConfig {
  send: (ioToRender: T_IO_RENDER) => Promise<void>
}

export type Executor<MethodName extends T_IO_METHOD_NAMES> = (
  resolve: (input: ComponentReturnValue<MethodName>) => void,
  reject?: () => void
) => void

type IOPromiseMap = {
  [MethodName in T_IO_METHOD_NAMES]: IOPromise<MethodName>
}

type AnyIOPromise = IOPromiseMap[T_IO_METHOD_NAMES]

export default function createIOClient(clientConfig: ClientConfig) {
  type ResponseHandlerFn = (fn: T_IO_RESPONSE) => void
  let onResponseHandler: ResponseHandlerFn | null = null

  async function renderComponents<
    Instances extends readonly AnyComponentType[] | []
  >(componentInstances: Instances) {
    const inputGroupKey = v4()

    type ReturnValues = {
      -readonly [Idx in keyof Instances]: z.infer<
        // @ts-ignore
        Instances[Idx]['schema']['returns']
      >
    }

    async function render() {
      const packed: T_IO_RENDER = {
        id: v4(),
        inputGroupKey: inputGroupKey,
        toRender: componentInstances.map(inst => inst.getRenderInfo()),
        kind: 'RENDER',
      }

      await clientConfig.send(packed)
    }

    onResponseHandler = async result => {
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

    return Promise.all(
      componentInstances.map(comp => comp.returnValue)
    ) as unknown as Promise<ReturnValues>
  }

  async function renderGroup<
    PromiseInstances extends readonly AnyIOPromise[] | [],
    ComponentInstances extends readonly AnyComponentType[] | []
  >(promiseInstances: PromiseInstances) {
    const componentInstances = promiseInstances.map(
      pi => pi.component
    ) as ComponentInstances

    type ReturnValues = {
      -readonly [Idx in keyof PromiseInstances]: z.infer<
        // @ts-ignore
        PromiseInstances[Idx]['component']['schema']['returns']
      >
    }

    return renderComponents(componentInstances) as unknown as ReturnValues
  }

  function ioPromiseConstructor<MethodName extends T_IO_METHOD_NAMES>(
    component: ComponentType<MethodName>
  ): IOPromise<MethodName> {
    return {
      component,
      then(resolve) {
        const componentInstances = [component] as unknown as Readonly<
          AnyComponentType[]
        >

        renderComponents(componentInstances).then(([result]) => {
          resolve(result)
        })
      },
    }
  }

  function aliasComponentName<MethodName extends T_IO_METHOD_NAMES>(
    methodName: MethodName
  ): (
    label: string,
    props?: T_IO_METHOD<MethodName, 'props'>
  ) => IOPromise<MethodName> {
    return (label: string, props?: T_IO_METHOD<MethodName, 'props'>) => {
      const c = component(methodName, label, props)
      return ioPromiseConstructor(c)
    }
  }

  return {
    io: {
      renderGroup,

      input: {
        text: aliasComponentName('INPUT_TEXT'),
        boolean: aliasComponentName('INPUT_BOOLEAN'),
        number: aliasComponentName('INPUT_NUMBER'),
        email: aliasComponentName('INPUT_EMAIL'),
        richText: aliasComponentName('INPUT_RICH_TEXT'),
      },
      select: {
        single: aliasComponentName('SELECT_SINGLE'),
        multiple: aliasComponentName('SELECT_MULTIPLE'),
        table: aliasComponentName('SELECT_TABLE'),
      },
      display: {
        heading: aliasComponentName('DISPLAY_HEADING'),
      },
      experimental: {
        findAndSelectUser: findAndSelectUser(ioPromiseConstructor),
        progressThroughList: progressThroughList(ioPromiseConstructor),
      },
    },
    onResponse: (result: T_IO_RESPONSE) => {
      if (onResponseHandler) {
        onResponseHandler?.(result)
      }
    },
  }
}

export type IOClient = ReturnType<typeof createIOClient>
