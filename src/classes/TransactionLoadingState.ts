import { LoadingOptions, LoadingState } from '../internalRpcSchema'
import Logger from './Logger'

export interface StartOrUpdateLoadingOptions extends LoadingOptions {
  label?: string
  description?: string
  itemsInQueue?: number
}

export interface TransactionLoadingStateConfig {
  logger: Logger
  send: (loadingState: LoadingState) => Promise<void>
}

export default class TransactionLoadingState {
  #logger: Logger
  #sender: TransactionLoadingStateConfig['send']
  #state: LoadingState | undefined

  constructor(config: TransactionLoadingStateConfig) {
    this.#sender = config.send
    this.#logger = config.logger
  }

  async #send(loadingState: LoadingState) {
    try {
      console.debug('Loading state:', loadingState)
      await this.#sender(loadingState)
    } catch (err) {
      this.#logger.error('Failed sending loading state to Interval')
      this.#logger.debug(err)
    }
  }

  get state() {
    return { ...this.#state }
  }

  start(options: StartOrUpdateLoadingOptions) {
    this.#state = { ...options }
    if (this.#state.itemsInQueue) {
      this.#state.itemsCompleted = 0
    }

    this.#send(this.#state)
  }

  update(options: StartOrUpdateLoadingOptions) {
    if (!this.#state) {
      this.#logger.warn('Please call `loading.start` before `loading.update`')
      this.start(options)
      return
    }

    Object.assign(this.#state, options)

    if (this.#state?.itemsInQueue && this.#state.itemsCompleted === undefined) {
      this.#state.itemsCompleted = 0
    }

    this.#send(this.#state)
  }

  completeOne() {
    if (!this.#state || !this.#state.itemsInQueue) {
      this.#logger.warn(
        'Please call `loading.start` with `itemsInQueue` before `loading.completeOne`, failing to do so does nothing.'
      )
      return
    }

    if (this.#state.itemsCompleted === undefined) {
      this.#state.itemsCompleted = 0
    }

    this.#state.itemsCompleted++
    this.#send(this.#state)
  }
}
