import type { T_IO_PROPS, T_IO_RETURNS } from '../ioSchema'

export default function urlInput() {
  return {
    getValue(response: T_IO_RETURNS<'INPUT_URL'>) {
      // The client also validates URLs using the URL interface.
      return new URL(response)
    },
  }
}
