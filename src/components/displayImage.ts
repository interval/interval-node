import { T_IO_PROPS, ImageSize } from '../ioSchema'
import { IntervalError } from '..'

const MAX_BUFFER_SIZE_MB = 50

export default function displayImage(
  props: {
    alt?: T_IO_PROPS<'DISPLAY_IMAGE'>['alt']
    width?: T_IO_PROPS<'DISPLAY_IMAGE'>['width']
    height?: T_IO_PROPS<'DISPLAY_IMAGE'>['height']
    maxWidth?: T_IO_PROPS<'DISPLAY_IMAGE'>['maxWidth']
    maxHeight?: T_IO_PROPS<'DISPLAY_IMAGE'>['maxHeight']
    maxSize?: ImageSize
  } & (
    | {
        url: string
      }
    | {
        buffer: Buffer
      }
  )
) {
  const maxSize = props.maxSize
  delete props.maxSize
  props.maxWidth = maxSize ? maxSize : props.maxWidth
  props.maxHeight = maxSize ? maxSize : props.maxHeight

  if ('buffer' in props) {
    if (Buffer.byteLength(props.buffer) > MAX_BUFFER_SIZE_MB * 1000 * 1000) {
      throw new IntervalError(
        `Buffer for io.display.image is too large, must be under ${MAX_BUFFER_SIZE_MB} MB`
      )
    }

    const data = props.buffer.toString('base64')

    let mime
    switch (data[0]) {
      case 'i':
        mime = 'image/png'
        break
      case 'R':
        mime = 'image/gif'
        break
      case '/':
        mime = 'image/jpeg'
        break
      case 'U':
        mime = 'image/webp'
        break
      default:
        mime = 'image/unknown'
        break
    }

    return {
      props: {
        ...props,
        url: `data:${mime};base64,${data}`,
      },
    }
  } else {
    return { props }
  }
}
