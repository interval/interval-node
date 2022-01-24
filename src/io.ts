import { v4 } from 'uuid'
import { z } from 'zod'
import { T_IO_METHOD, T_IO_METHOD_NAMES } from './ioSchema'
import type { T_IO_RENDER, T_IO_RESPONSE } from './ioSchema'
import component from './component'
import progressThroughList from './components/progressThroughList'
import findAndSelectUser from './components/selectUser'

function aliasComponentName<MethodName extends T_IO_METHOD_NAMES>(
  methodName: MethodName
) {
  return (props: T_IO_METHOD<MethodName, 'props'>) =>
    component(methodName, props)
}

interface ClientConfig {
  send: (ioToRender: T_IO_RENDER) => Promise<void>
}

export default function createIOClient(clientConfig: ClientConfig) {
  type ResponseHandlerFn = (fn: T_IO_RESPONSE) => void
  let onResponseHandler: ResponseHandlerFn | null = null

  function inputGroup<Instance extends ReturnType<typeof component>[] | []>(
    componentInstances: Instance
  ) {
    const inputGroupKey = v4()

    type ReturnValues = {
      //@ts-ignore
      [Idx in keyof Instance]: z.infer<Instance[Idx]['schema']['returns']>
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
      console.log('handle resp', result)

      if (result.values.length !== componentInstances.length) {
        throw new Error('Mismatch in return array length')
      }

      if (result.kind === 'RETURN') {
        result.values.map((v, index) =>
          componentInstances[index].setReturnValue(v)
        )

        return
      }

      if (result.kind === 'SET_STATE') {
        for (const [index, newState] of result.values.entries()) {
          const prevState = componentInstances[index].getInstance().state

          if (JSON.stringify(newState) !== JSON.stringify(prevState)) {
            console.log(`New state at ${index}`, newState)
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

  return {
    io: {
      renderGroup: inputGroup,
      findAndSelectUser,
      input: {
        text: aliasComponentName('ASK_TEXT'),
        boolean: aliasComponentName('INPUT_BOOLEAN'),
        number: aliasComponentName('INPUT_NUMBER'),
        email: aliasComponentName('INPUT_EMAIL'),
      },
      select: {
        single: aliasComponentName('SELECT_SINGLE'),
        multiple: aliasComponentName('SELECT_MULTIPLE'),
      },
      display: {
        heading: aliasComponentName('DISPLAY_HEADING'),
        progressThroughList,
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
