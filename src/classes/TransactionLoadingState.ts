import {
  LoadingOptions,
  LoadingState as RPCLoadingState,
} from '../internalRpcSchema'
import Logger from './Logger'

export type LoadingState = Omit<RPCLoadingState, 'label'> & {
  title?: string
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

  get #transformedState(): RPCLoadingState {
    return {
      label: this.#state?.title,
      description: this.#state?.description,
      itemsInQueue: this.#state?.itemsInQueue,
      itemsCompleted: this.#state?.itemsCompleted,
    }
  }

  async #sendState() {
    try {
      console.debug('Loading state:', this.#state)
      await this.#sender(this.#transformedState)
    } catch (err) {
      this.#logger.error('Failed sending loading state to Interval')
      this.#logger.debug(err)
    }
  }

  get state() {
    return { ...this.#state }
  }

  async start(options?: string | LoadingOptions) {
    if (typeof options === 'string') {
      options = { title: options }
    } else if (options === undefined) {
      options = {}
    }

    this.#state = { ...options }
    if (this.#state.itemsInQueue) {
      this.#state.itemsCompleted = 0
    }

    return this.#sendState()
  }

  async update(options?: string | LoadingOptions) {
    if (!this.#state) {
      this.#logger.warn('Please call `loading.start` before `loading.update`')
      return this.start(options)
    }

    if (typeof options === 'string') {
      options = { title: options }
    } else if (options === undefined) {
      options = {}
    }

    Object.assign(this.#state, options)

    if (this.#state?.itemsInQueue && this.#state.itemsCompleted === undefined) {
      this.#state.itemsCompleted = 0
    }

    return this.#sendState()
  }

  async completeOne() {
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
    return this.#sendState()
  }
}
