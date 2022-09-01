import { T_IO_PROPS } from '../ioSchema'

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
  console.log('props')
  if ('buffer' in props) {
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
