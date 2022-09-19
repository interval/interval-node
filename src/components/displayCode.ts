import { T_IO_PROPS, ImageSize } from '../ioSchema'
import { IntervalError } from '..'

const MAX_BUFFER_SIZE_MB = 5

export default function displayCode(
  props: {
    language?: T_IO_PROPS<'DISPLAY_CODE'>['language']
  } & (
    | {
        text: string
      }
    | {
        buffer: Buffer
      }
  )
) {
  if ('buffer' in props) {
    if (Buffer.byteLength(props.buffer) > MAX_BUFFER_SIZE_MB * 1000 * 1000) {
      throw new IntervalError(
        `Buffer for io.display.code is too large, must be under ${MAX_BUFFER_SIZE_MB} MB`
      )
    }

    const text = props.buffer.toString('utf8')

    return {
      props: {
        ...props,
        text,
      },
      async prepareProps(props: T_IO_PROPS<'DISPLAY_CODE'>) {
        return props
      },
    }
  } else {
    return { props }
  }
}
