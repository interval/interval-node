import { v4 } from 'uuid'
import { z } from 'zod'
import { ioSchema } from './ioSchema'

type ComponentFn = <MethodName extends keyof typeof ioSchema>(
  methodName: MethodName,
  inputs: z.infer<typeof ioSchema[MethodName]['inputs']>
) => {
  inputs: typeof inputs
  methodName: typeof methodName
  returnValidator: (
    rawReturn: any
  ) => z.infer<typeof ioSchema[MethodName]['returns']>
}

const component: ComponentFn = (methodName, inputs) => {
  return {
    methodName,
    inputs,
    returnValidator: value => {
      return ioSchema[methodName]['returns'].parse(value)
    },
  }
}

export const IO_CALL = z.object({
  id: z.string(),
  toRender: z.array(z.object({ methodName: z.string(), inputs: z.any() })),
  kind: z.literal('CALL'),
})

export const IO_RESPONSE = z.object({
  id: z.string(),
  responseValues: z.array(z.any()),
  kind: z.literal('RESPONSE'),
})

export type IOCall = z.infer<typeof IO_CALL>
export type IOResponse = z.infer<typeof IO_RESPONSE>

export default function createIOClient(
  sendFn: (callToSend: IOCall) => Promise<IOResponse>
) {
  // This function isn't statically type safe, so we need to be careful
  async function inputGroup<A extends readonly ReturnType<ComponentFn>[] | []>(
    arr: A
  ): Promise<{
    -readonly // @ts-ignore
    [P in keyof A]: ReturnType<A[P]['returnValidator']>
  }> {
    const methods: IOCall['toRender'] = []
    for (const item of arr) {
      methods.push({
        methodName: item.methodName,
        inputs: item.inputs,
      })
    }

    const packed: IOCall = {
      id: v4(),
      toRender: methods,
      kind: 'CALL',
    }

    const result = await sendFn(packed)

    console.log('packed', packed, result)

    if (result.responseValues.length !== arr.length) {
      throw new Error('Mismatch in return array length')
    }

    // Be careful!
    return arr.map((el, i) =>
      el.returnValidator(result.responseValues[i])
    ) as unknown as {
      -readonly // @ts-ignore
      [P in keyof A]: ReturnType<A[P]['returnValidator']>
    }
  }

  async function input<A extends ReturnType<ComponentFn>>(component: A) {
    const result = await inputGroup([component])
    return result[0]
  }

  async function forEach<T>(arr: T[], fn: (value: T) => Promise<any>) {
    input(
      component('DISPLAY_HEADING', {
        label: `Loading... 0/${arr.length}`,
      })
    )
    for (const [idx, item] of arr.entries()) {
      await fn(item)
      input(
        component('DISPLAY_HEADING', {
          label: `Loading... ${idx}/${arr.length}`,
        })
      )
    }
  }

  return { inputGroup, input, component, forEach }
}

export type IOClient = ReturnType<typeof createIOClient>
