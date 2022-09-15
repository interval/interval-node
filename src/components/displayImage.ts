import { T_IO_PROPS, ImageSize } from '../ioSchema'
import { bufferToDataUrl } from '../utils/image'

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
    return {
      props: {
        ...props,
        url: bufferToDataUrl(props.buffer),
      },
    }
  } else {
    return { props }
  }
}
