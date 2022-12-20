export default class IntervalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntervalError'
  }
}
