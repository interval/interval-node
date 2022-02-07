import { z } from 'zod'
import component, { ComponentType } from '../component'
import type { T_IO_METHOD } from '../ioSchema'
import { COLUMN_DEFS } from '../utils/spreadsheet'

export default function spreadsheet(
  renderer: (
    componentInstances: ComponentType<'INPUT_SPREADSHEET'>[]
  ) => Promise<T_IO_METHOD<'INPUT_SPREADSHEET', 'returns'>[]>
) {
  return <
    Props extends T_IO_METHOD<'INPUT_SPREADSHEET', 'props'>,
    Columns extends Props['columns']
  >(
    label: string,
    props: Props
  ) => {
    const c = component('INPUT_SPREADSHEET', label, {
      ...props,
    })

    const _output: {
      [key in keyof Columns]: z.infer<typeof COLUMN_DEFS[Columns[key]]>
    }[] = []

    return {
      component: c,
      _output,
      then(
        resolve: (
          input: {
            [key in keyof Columns]: z.infer<typeof COLUMN_DEFS[Columns[key]]>
          }[]
        ) => void
      ) {
        renderer([c]).then(([result]) => {
          resolve(
            result as {
              [key in keyof Columns]: z.infer<typeof COLUMN_DEFS[Columns[key]]>
            }[]
          )
        })
      },
    }
  }
}
