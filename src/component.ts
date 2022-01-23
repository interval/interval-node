import { z } from 'zod'
import { ioSchema } from './ioSchema'

type IoSchema = typeof ioSchema
export interface ComponentInstance<MN extends keyof IoSchema> {
  methodName: MN
  props: z.infer<IoSchema[MN]['props']>
  state: z.infer<IoSchema[MN]['state']>
}

const component = <MN extends keyof IoSchema>(
  methodName: MN,
  initialProps: z.infer<IoSchema[MN]['props']>,
  handleStateChange?: (
    incomingState: z.infer<IoSchema[MN]['state']>
  ) => Promise<z.infer<IoSchema[MN]['props']>>
) => {
  const instance: ComponentInstance<MN> = {
    methodName,
    props: initialProps,
    state: null,
  }

  type RenderInfo = Pick<typeof instance, 'methodName' | 'props'>

  let onStateChangeHandler: (() => void) | null = null

  type ReturnValue = z.infer<typeof schema['returns']>

  let resolver: ((v: ReturnValue) => void) | null = null
  const returnValue = new Promise<ReturnValue>(resolve => {
    resolver = resolve
  })

  const schema = ioSchema[methodName]

  function setReturnValue(value: any) {
    const parsed = schema.returns.parse(value)
    if (resolver) {
      resolver(parsed)
    }
  }

  async function setState(newState: any) {
    const parsedState = schema.state.parse(newState)
    if (handleStateChange) {
      instance.props = await handleStateChange(parsedState)
    }
    if (parsedState !== null && !handleStateChange) {
      console.warn(
        'Received non-null state, but no method was defined to handle.'
      )
    }
    console.log('set state!', onStateChangeHandler)
    onStateChangeHandler && onStateChangeHandler()
    return instance
  }

  // TODO: can we get a type for newProps
  function setProps(newProps: any) {
    instance.props = newProps
    onStateChangeHandler && onStateChangeHandler()
  }

  function getInstance() {
    return instance
  }

  function getRenderInfo(): RenderInfo {
    return {
      methodName: instance.methodName,
      props: instance.props,
    }
  }

  return {
    onStateChange: (fn: () => void) => {
      onStateChangeHandler = fn
    },
    schema,
    getInstance,
    getRenderInfo,
    returnValue,
    setState,
    setProps,
    setReturnValue,
  }
}

export default component
