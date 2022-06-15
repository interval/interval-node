import { T_IO_PROPS, T_IO_RETURNS } from '../ioSchema'

export function toUrl(_: T_IO_PROPS<'UPLOAD_FILE'>) {
  return {
    getValue(response: T_IO_RETURNS<'UPLOAD_FILE'>) {
      return {
        ...response,
        lastModified: new Date(response.lastModified),
      }
    },
  }
}
