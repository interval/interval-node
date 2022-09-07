import { T_IO_PROPS, ImageSize } from '../ioSchema'
import { IntervalError } from '..'

const MAX_BUFFER_SIZE_MB = 50

export default function displayVideo(
  props: {
    width?: T_IO_PROPS<'DISPLAY_VIDEO'>['width']
    height?: T_IO_PROPS<'DISPLAY_VIDEO'>['height']
    size?: ImageSize
    muted?: T_IO_PROPS<'DISPLAY_VIDEO'>['muted']
    loop?: T_IO_PROPS<'DISPLAY_VIDEO'>['loop']
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

    // using first character as a simple check for common video formats:
    let mime
    switch (data[0]) {
      case 'A':
        mime = 'video/mp4'
        break
      case 'G':
        mime = 'video/webm'
        break
      case 'T':
        mime = 'video/ogg'
        break
      case 'U':
        mime = 'video/avi'
        break
      default:
        // A fallback of `video/unknown` doesn't work like it does for images.
        // Various formats seem to play fine in chrome with mp4.
        // Still relying on the switch ^^ for correctness though.
        mime = 'video/mp4'
        break
    }

    return {
      props: {
        ...props,
        url: `data:${mime};base64,${data}`,
      },
      async prepareProps(props: T_IO_PROPS<'DISPLAY_VIDEO'>) {
        return props
      },
    }
  } else {
    return { props }
  }
}
