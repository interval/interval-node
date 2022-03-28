import { z } from 'zod'
import { ioSchema, resolvesImmediately } from './ioSchema'
import { deserializeDates } from './utils/deserialize'

export type IoSchema = typeof ioSchema
export interface ComponentInstance<MN extends keyof IoSchema> {
  methodName: MN
  label: string
  props?: z.input<IoSchema[MN]['props']>
  state: z.infer<IoSchema[MN]['state']>
  isStateful?: boolean
  isOptional?: boolean
}

export interface ComponentType<MN extends keyof IoSchema> {
  onStateChange: (fn: () => void) => void
  schema: IoSchema[MN]
  label: string
  getInstance: () => ComponentInstance<MN>
  getRenderInfo: () => ComponentRenderInfo<MN>
  returnValue: Promise<ComponentReturnValue<MN> | undefined>
  setState: (
    newState: z.infer<IoSchema[MN]['state']>
  ) => Promise<ComponentInstance<MN>>
  setProps: (newProps: z.input<IoSchema[MN]['props']>) => void
  setReturnValue: (value: z.infer<IoSchema[MN]['returns']>) => void
  setOptional: (optional: boolean) => void
}

export type ComponentRenderInfo<MN extends keyof IoSchema> = Pick<
  ComponentInstance<MN>,
  'methodName' | 'label' | 'props' | 'isStateful' | 'isOptional'
>

export type ComponentReturnValue<MN extends keyof IoSchema> = z.infer<
  IoSchema[MN]['returns']
>

export type ComponentTypeMap = {
  [MethodName in keyof IoSchema]: ComponentType<MethodName>
}

export type AnyComponentType = ComponentTypeMap[keyof IoSchema]

const component = <MN extends keyof IoSchema>(
  methodName: MN,
  label: string,
  initialProps?: z.input<IoSchema[MN]['props']>,
  handleStateChange?: (
    incomingState: z.infer<IoSchema[MN]['state']>
  ) => Promise<Partial<z.input<IoSchema[MN]['props']>>>
  // a new, optional function that can further transform the return value w/ access to the original props
  // transformer?: (
  //   returnValue: z.infer<IoSchema[MN]['returns']>,
  //   initialProps?: z.input<IoSchema[MN]['props']>
  // ) => z.infer<IoSchema[MN]['returns']>
): ComponentType<MN> => {
  const instance: ComponentInstance<MN> = {
    methodName,
    label,
    props: initialProps,
    state: null,
    isStateful: !!handleStateChange,
    isOptional: false,
  }

  let onStateChangeHandler: (() => void) | null = null

  let resolver: ((v: ComponentReturnValue<MN> | undefined) => void) | null =
    null
  const returnValue = new Promise<ComponentReturnValue<MN> | undefined>(
    resolve => {
      resolver = resolve
    }
  )

  const schema = ioSchema[methodName]

  function setReturnValue(value: z.input<IoSchema[MN]['returns']>) {
    const returnSchema = instance.isOptional
      ? schema.returns
          .nullable()
          .optional()
          // JSON.stringify turns undefined into null in arrays
          .transform(value => value ?? undefined)
      : schema.returns

    try {
      let parsed: ReturnType<typeof returnSchema.parse>

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed = returnSchema.parse(deserializeDates(value))
      } else {
        parsed = returnSchema.parse(value)
      }

      if (resolver) {
        resolver(parsed)
      }
    } catch (err) {
      console.error('Received invalid return value:', err)
    }
  }

  async function setState(
    newState: z.infer<IoSchema[MN]['state']>
  ): Promise<ComponentInstance<MN>> {
    try {
      const parsedState = schema.state.parse(newState)
      if (handleStateChange) {
        instance.props = {
          ...instance.props,
          ...(await handleStateChange(parsedState)),
        }
      }
      if (parsedState !== null && !handleStateChange) {
        console.warn(
          'Received non-null state, but no method was defined to handle.'
        )
      }
      onStateChangeHandler && onStateChangeHandler()
    } catch (err) {
      console.error('Received invalid state:', err)
    }

    return instance
  }

  function setProps(newProps: z.input<IoSchema[MN]['props']>) {
    instance.props = newProps
    onStateChangeHandler && onStateChangeHandler()
  }

  function getInstance() {
    return instance
  }

  function setOptional(optional: boolean) {
    instance.isOptional = optional
  }

  function getRenderInfo(): ComponentRenderInfo<MN> {
    return {
      methodName: instance.methodName,
      label: instance.label,
      props: instance.props,
      isStateful: instance.isStateful,
      isOptional: instance.isOptional,
    }
  }

  // Immediately resolve any methods defined as immediate in schema
  setImmediate(() => {
    if (resolvesImmediately(methodName) && resolver) {
      resolver(null)
    }
  })

  return {
    onStateChange: (fn: () => void) => {
      onStateChangeHandler = fn
    },
    schema,
    label,
    getInstance,
    getRenderInfo,
    returnValue,
    setState,
    setProps,
    setReturnValue,
    setOptional,
  }
}

export default component
