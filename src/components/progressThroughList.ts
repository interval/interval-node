/**
 * FIXME: This needs some work if we want to continue to support it.
 */

export default {}
/*
import { T_IO_PROPS } from '../ioSchema'

type ProgressibleItem =
  | {
      label: string
    }
  | string

type ProgressList = T_IO_PROPS<'DISPLAY_PROGRESS_THROUGH_LIST'>['items']

export default function progressThroughList<T extends ProgressibleItem>({
  items,
  eachItemFn,
}: {
  items: T[]
  eachItemFn: (item: T) => Promise<string>
}) {
  const progressItems: ProgressList = items.map(item => {
    return {
      label: typeof item === 'string' ? item : item['label'],
      isComplete: false,
      resultDescription: null,
    }
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

  return {
    props: {
      items: progressItems,
    },
  }
}
*/
