import { v4 } from 'uuid'
import { z } from 'zod'
import { ioSchema } from './ioSchema'
import type { IOCall, IOResponse } from './ioSchema'

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
  console.log('comp')
  return {
    methodName,
    inputs,
    returnValidator: value => {
      return ioSchema[methodName]['returns'].parse(value)
    },
  }
}

export default function createIOClient(
  sendFn: (callToSend: IOCall) => Promise<IOResponse>
) {
  // This function isn't statically type safe, so we need to be careful
  async function inputGroup<A extends readonly ReturnType<ComponentFn>[] | []>(
    arr: A
  ): Promise<
    {
      -readonly // @ts-ignore
      [P in keyof A]: ReturnType<A[P]['returnValidator']>
    }
  > {
    console.log('ig')
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

  type ItemWithLabel =
    | {
        label: string
      }
    | string

  type ProgressThroughListOptions<T> = {
    label: string
    items: T[]
    itemHandler: (value: T) => Promise<string | void>
  }

  async function progressThroughList<T extends ItemWithLabel>(
    props: ProgressThroughListOptions<T>
  ) {
    type ProgressList = z.infer<
      typeof ioSchema['DISPLAY_PROGRESS_THROUGH_LIST']['inputs']
    >['items']

    const progressItems: ProgressList = props.items.map(item => {
      return {
        label: typeof item === 'string' ? item : item['label'],
        isComplete: false,
        resultDescription: null,
      }
    })

    input(
      component('DISPLAY_PROGRESS_THROUGH_LIST', {
        label: props.label,
        items: progressItems,
      })
    )
    for (const [idx, item] of props.items.entries()) {
      const resp = await props.itemHandler(item)
      progressItems[idx].isComplete = true
      progressItems[idx].resultDescription = resp || null
      input(
        component('DISPLAY_PROGRESS_THROUGH_LIST', {
          label: props.label,
          items: progressItems,
        })
      )
    }
  }

  function aliasMethodName<MethodName extends keyof typeof ioSchema>(
    methodName: MethodName
  ) {
    return (inputs: z.infer<typeof ioSchema[MethodName]['inputs']>) =>
      component(methodName, inputs)
  }

  return {
    inputGroup,
    input,
    display: {
      heading: aliasMethodName('DISPLAY_HEADING'),
      progressThroughList,
    },
    ask: {
      forText: aliasMethodName('ASK_TEXT'),
      forEmail: aliasMethodName('ASK_EMAIL'),
      forNumber: aliasMethodName('ASK_NUMBER'),
      forConfirmation: aliasMethodName('ASK_CONFIRM'),
      forSingle: aliasMethodName('ASK_SINGLE'),
      forMultiple: aliasMethodName('ASK_MULTIPLE'),
      forBoolean: aliasMethodName('ASK_BOOLEAN'),
    },
    select: {
      fromTabularData: aliasMethodName('SELECT_FROM_TABULAR_DATA'),
    },
  }
}

export type IOClient = ReturnType<typeof createIOClient>
