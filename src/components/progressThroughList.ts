import { T_IO_METHOD } from '../ioSchema'
import component, { ComponentType } from '../component'
import { IOPromise } from '../io'
import type { Executor } from '../io'

type ProgressibleItem =
  | {
      label: string
    }
  | string

type ProgressList = T_IO_METHOD<
  'DISPLAY_PROGRESS_THROUGH_LIST',
  'props'
>['items']

export default function progressThroughList(
  executor: (
    c: ComponentType<'DISPLAY_PROGRESS_THROUGH_LIST'>
  ) => Executor<'DISPLAY_PROGRESS_THROUGH_LIST'>
) {
  return <T extends ProgressibleItem>(
    items: T[],
    eachItemFn: (item: T) => Promise<string>,
    props: { label: string }
  ) => {
    const progressItems: ProgressList = items.map(item => {
      return {
        label: typeof item === 'string' ? item : item['label'],
        isComplete: false,
        resultDescription: null,
      }
    })

    const c = component('DISPLAY_PROGRESS_THROUGH_LIST', {
      label: props.label,
      items: progressItems,
    })

    async function loop() {
      for (const [idx, item] of items.entries()) {
        console.log('Iterating...', idx)
        const resultText = await eachItemFn(item)

        progressItems[idx].resultDescription = resultText
        progressItems[idx].isComplete = true

        c.setProps({ items: progressItems, label: props.label })
      }
      c.setReturnValue(null)
    }
    loop()

    return new IOPromise(executor(c), c)
  }
}
