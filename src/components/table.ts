import { T_IO_PROPS, tableColumn, tableRow } from '../ioSchema'
import component from '../component'
import type { IOPromiseConstructor, IOPromise } from '../io'
import { columnsBuilder, tableRowSerializer } from '../utils/table'
import { z } from 'zod'

// Overrides internal schema with user-facing defs for columns & data
type InputProps = Omit<T_IO_PROPS<'SELECT_TABLE'>, 'data' | 'columns'> & {
  columns?: z.input<typeof tableColumn>[]
  data: z.input<typeof tableRow>[]
}

export function selectTable(constructor: IOPromiseConstructor<'SELECT_TABLE'>) {
  return <Props extends InputProps>(label: string, props: Props) => {
    type DataList = typeof props['data']

    const data = props.data.map((row, idx) =>
      tableRowSerializer(idx, row, props.columns)
    )

    const columns = columnsBuilder(props)

    return {
      ...constructor(
        component('SELECT_TABLE', label, {
          ...props,
          data,
          columns,
        })
      ),
      getValue(response) {
        const indices = response.map(row => Number(row.key))

        const rows = props.data.filter((_, idx) => indices.includes(idx))

        return rows as DataList
      },
    } as IOPromise<'SELECT_TABLE', DataList>
  }
}

export function displayTable(
  constructor: IOPromiseConstructor<'DISPLAY_TABLE'>
) {
  return <Props extends InputProps>(label: string, props: Props) => {
    const data = props.data.map((row, idx) =>
      tableRowSerializer(idx, row, props.columns)
    )

    const columns = columnsBuilder(props)

    return constructor(
      component('DISPLAY_TABLE', label, {
        ...props,
        data,
        columns,
      })
    )
  }
}
