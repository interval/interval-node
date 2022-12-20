export type IOErrorKind =
  | 'CANCELED'
  | 'TRANSACTION_CLOSED'
  | 'BAD_RESPONSE'
  | 'RESPONSE_HANDLER_ERROR'

export default class IOError extends Error {
  kind: IOErrorKind

  constructor(kind: IOErrorKind, message?: string) {
    super(message)
    this.kind = kind
    this.name = 'IOError'
  }
}
