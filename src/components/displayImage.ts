import { T_IO_PROPS } from '../ioSchema'
import { IntervalError } from '..'

const MAX_BUFFER_SIZE_MB = 50

export default function displayImage(
  props: {
    alt?: T_IO_PROPS<'DISPLAY_IMAGE'>['alt']
    width?: T_IO_PROPS<'DISPLAY_IMAGE'>['width']
    height?: T_IO_PROPS<'DISPLAY_IMAGE'>['height']
  } & (
    | {
        url: string
      }
    | {
        buffer: Buffer
      }
  )
) {
  if ('buffer' in props) {
    if (Buffer.byteLength(props.buffer) > MAX_BUFFER_SIZE_MB * 1000 * 1000) {
      throw new IntervalError(
        `Buffer for io.display.image is too big, must be under ${MAX_BUFFER_SIZE_MB} MB`
      )
    }
    return {
      props: {
        ...props,
        buffer: props.buffer.toString('base64'),
      },
    }
  } else {
    return { props }
  }
}
