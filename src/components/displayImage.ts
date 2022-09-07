import { T_IO_PROPS, ImageSize } from '../ioSchema'
import { IntervalError } from '..'

const MAX_BUFFER_SIZE_MB = 50

export default function displayImage(
  props: {
    alt?: T_IO_PROPS<'DISPLAY_IMAGE'>['alt']
    width?: T_IO_PROPS<'DISPLAY_IMAGE'>['width']
    height?: T_IO_PROPS<'DISPLAY_IMAGE'>['height']
    size?: ImageSize
  } & (
    | {
        url: string
      }
    | {
        buffer: Buffer
      }
  )
) {
  const size = props.size
  delete props.size
  props.width = size ? size : props.width
  props.height = size ? size : props.height

  if ('buffer' in props) {
    if (Buffer.byteLength(props.buffer) > MAX_BUFFER_SIZE_MB * 1000 * 1000) {
      throw new IntervalError(
        `Buffer for io.display.image is too large, must be under ${MAX_BUFFER_SIZE_MB} MB`
      )
    }

    const data = props.buffer.toString('base64')

    // using first character as a simple check for common image formats:
    // https://stackoverflow.com/questions/27886677/javascript-get-extension-from-base64-image/50111377#50111377
    // image/unknown actually seems to just work for all the types I've
    // encountered, but we can expand this switch if we need to
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
