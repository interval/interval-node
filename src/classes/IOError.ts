export type IOErrorKind =
  | 'CANCELED'
  | 'TRANSACTION_CLOSED'
  | 'BAD_RESPONSE'
  | 'RESPONSE_HANDLER_ERROR'
  | 'RENDER_ERROR'

export default class IOError extends Error {
  kind: IOErrorKind

  constructor(kind: IOErrorKind, message?: string, options?: { cause?: any }) {
    super(message, options)
    this.kind = kind
    this.name = 'IOError'
  }
}
