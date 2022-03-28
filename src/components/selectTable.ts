import { T_IO_PROPS, tableColumn, tableRow } from '../ioSchema'
import component from '../component'
import type { IOPromiseConstructor, IOPromise } from '../io'
import { columnsBuilder, tableRowSerializer } from '../utils/table'
import { z } from 'zod'

// Overrides internal schema with user-facing defs for columns & data
type InputProps = Omit<T_IO_PROPS<'SELECT_TABLE'>, 'data' | 'columns'> & {
  columns?: z.infer<typeof tableColumn>[]
  data: z.infer<typeof tableRow>[]
}

export default function selectTable(
  constructor: IOPromiseConstructor<'SELECT_TABLE'>
) {
  return <Props extends InputProps, DataList extends Props['data']>(
    label: string,
    props: Props
  ) => {
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

        const rows = props.data.filter((row, idx) => indices.includes(idx))

        return rows
      },
      // TODO: smarter type here
    } as IOPromise<'SELECT_TABLE', any[]>
  }
}
