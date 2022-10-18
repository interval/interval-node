import { z } from 'zod'
import Logger from '../classes/Logger'
import { T_IO_PROPS, metadataObject } from '../ioSchema'
import { TableColumn } from '../types'
import {
  columnsBuilder,
  tableRowSerializer,
  missingColumnMessage,
  columnsWithoutRender,
} from '../utils/table'

type PublicProps<Row> = Omit<
  T_IO_PROPS<'DISPLAY_METADATA'>,
  'data' | 'columns'
> & {
  data: Row
  columns?: (TableColumn<Row> | string)[]
}

export default function displayMetadata(logger: Logger) {
  return function displayMetadata<
    Row extends z.input<typeof metadataObject> = any
  >(props: PublicProps<Row>) {
    const columns = columnsBuilder(
      {
        ...props,
        data: [props.data],
      },
      column =>
        logger.error(missingColumnMessage('io.display.metadata')(column))
    )

    const { data } = tableRowSerializer({
      key: '0',
      row: props.data,
      columns,
      logger,
    })

    return {
      props: {
        ...props,
        // we use an array to keep the syntax consistent with the table row schema
        data: [{ key: '0', data }],
        columns: columnsWithoutRender(columns),
      } as T_IO_PROPS<'DISPLAY_METADATA'>,
    }
  }
}
