import { T_IO_PROPS } from '../ioSchema'
import component from '../component'
import type { IOPromiseConstructor, IOPromise } from '../io'
import { columnsBuilder, tableRowSerializer } from '../utils/table'

export default function selectTable(
  constructor: IOPromiseConstructor<'SELECT_TABLE'>
) {
  return <
    Props extends T_IO_PROPS<'SELECT_TABLE'>,
    DataList extends Props['data']
  >(
    label: string,
    props: Props
  ) => {
    const data = props.data.map(row => tableRowSerializer(row, props.columns))

    const columns = columnsBuilder(props)

    return constructor(
      component('SELECT_TABLE', label, {
        ...props,
        data,
        columns,
      })
    ) as IOPromise<'SELECT_TABLE', DataList>
  }
}
