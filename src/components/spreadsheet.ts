import { z } from 'zod'
import component, { ComponentType } from '../component'
import type { T_IO_METHOD } from '../ioSchema'
import { extractColumns } from '../utils/spreadsheet'

export default function spreadsheet(
  renderer: (
    componentInstances: ComponentType<'INPUT_SPREADSHEET'>[]
  ) => Promise<T_IO_METHOD<'INPUT_SPREADSHEET', 'returns'>[]>
) {
  return (label: string, props: T_IO_METHOD<'INPUT_SPREADSHEET', 'props'>) => {
    const outputSchema = extractColumns(props.columns)
    type ReturnValue = z.infer<typeof outputSchema>

    const c = component('INPUT_SPREADSHEET', label, {
      ...props,
    })

    return {
      component: c,
      then(resolve: (input: ReturnValue) => void) {
        renderer([c]).then(([result]) => {
          resolve(result as ReturnValue)
        })
      },
    }
  }
}
