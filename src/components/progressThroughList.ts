import { T_IO_PROPS } from '../ioSchema'
import component from '../component'
import type { IOPromiseConstructor } from '../io'

type ProgressibleItem =
  | {
      label: string
    }
  | string

type ProgressList = T_IO_PROPS<'DISPLAY_PROGRESS_THROUGH_LIST'>['items']

export default function progressThroughList(
  constructor: IOPromiseConstructor<'DISPLAY_PROGRESS_THROUGH_LIST'>
) {
  return <T extends ProgressibleItem>(
    label: string,
    items: T[],
    eachItemFn: (item: T) => Promise<string>
  ) => {
    const progressItems: ProgressList = items.map(item => {
      return {
        label: typeof item === 'string' ? item : item['label'],
        isComplete: false,
        resultDescription: null,
      }
    })

    const c = component('DISPLAY_PROGRESS_THROUGH_LIST', label, {
      items: progressItems,
    })

    async function loop() {
      for (const [idx, item] of items.entries()) {
        console.log('Iterating...', idx)
        const resultText = await eachItemFn(item)

        progressItems[idx].resultDescription = resultText
        progressItems[idx].isComplete = true

        c.setProps({ items: progressItems })
      }
      c.setReturnValue(null)
    }
    loop()

    return constructor(c)
  }
}
