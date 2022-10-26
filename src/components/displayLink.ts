import { SerializableRecord, T_IO_PROPS } from '../ioSchema'

export default function displayLink(
  props: {
    theme?: T_IO_PROPS<'DISPLAY_LINK'>['theme']
  } & (
    | {
        url: string
      }
    | {
        route: string
        params?: SerializableRecord
      }
    // deprecated in favor of `route`
    // TODO: Add TS deprecated flag soon
    | {
        action: string
        params?: SerializableRecord
      }
  )
) {
  return {
    props: props as T_IO_PROPS<'DISPLAY_LINK'>,
  }
}
