import { z } from 'zod'
import fetch from 'node-fetch'
import Actions from './classes/Actions'
import IOError from './classes/IOError'
import Logger from './classes/Logger'
import { NOTIFY, ActionEnvironment } from './internalRpcSchema'
import { SerializableRecord } from './ioSchema'
import type {
  ActionCtx,
  ActionLogFn,
  IO,
  IntervalActionHandler,
  IntervalActionStore,
  NotifyConfig,
  IntervalActionDefinitions,
} from './types'
import IntervalClient, {
  DEFAULT_WEBSOCKET_ENDPOINT,
  getHttpEndpoint,
  actionLocalStorage,
} from './classes/IntervalClient'
import ActionGroup from './classes/ActionGroup'

export type {
  ActionCtx,
  ActionLogFn,
  IO,
  IntervalActionHandler,
  IntervalActionStore,
}

export interface InternalConfig {
  apiKey?: string
  actions?: IntervalActionDefinitions
  groups?: Record<string, ActionGroup>
  endpoint?: string
  logLevel?: 'prod' | 'debug'
  retryIntervalMs?: number
  pingIntervalMs?: number
  closeUnresponsiveConnectionTimeoutMs?: number
  reinitializeBatchTimeoutMs?: number
}

export interface QueuedAction {
  id: string
  assignee?: string
  params?: SerializableRecord
}

export class IntervalError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export function getActionStore(): IntervalActionStore {
  const store = actionLocalStorage.getStore()
  if (!store) {
    throw new IntervalError(
      'Global io and ctx objects can only be used inside an IntervalActionHandler'
    )
  }

  return store
}

// prettier-ignore
export const io: IO = {
  get group() { return getActionStore().io.group },
  get confirm() { return getActionStore().io.confirm },
  get search() { return getActionStore().io.search },
  get input() { return getActionStore().io.input },
  get select() { return getActionStore().io.select },
  get display() { return getActionStore().io.display },
  get experimental() { return getActionStore().io.experimental },
}

// prettier-ignore
export const ctx: ActionCtx = {
  get user() { return getActionStore().ctx.user },
  get params() { return getActionStore().ctx.params },
  get environment() { return getActionStore().ctx.environment },
  get loading() { return getActionStore().ctx.loading },
  get log() { return getActionStore().ctx.log },
  get organization() { return getActionStore().ctx.organization },
  get action() { return getActionStore().ctx.action },
  get notify() { return getActionStore().ctx.notify },
}

export default class Interval {
  config: InternalConfig
  #logger: Logger
  #client: IntervalClient | undefined
  #apiKey: string | undefined
  #httpEndpoint: string
  #actions: Actions

  organization:
    | {
        name: string
        slug: string
      }
    | undefined
  environment: ActionEnvironment | undefined

  constructor(config: InternalConfig) {
    this.config = config
    this.#apiKey = config.apiKey
    this.#logger = new Logger(config.logLevel)

    this.#httpEndpoint = getHttpEndpoint(
      config.endpoint ?? DEFAULT_WEBSOCKET_ENDPOINT
    )
    this.#actions = new Actions(
      this,
      this.#httpEndpoint,
      this.#logger,
      this.#apiKey
    )
  }

  get actions(): Actions {
    return this.#actions
  }

  /* @internal */ set actions(actions: Actions) {
    this.#actions = actions
  }

  protected get apiKey(): string | undefined {
    return this.#apiKey
  }

  protected get httpEndpoint(): string {
    return this.#httpEndpoint
  }

  get #log() {
    return this.#logger
  }

  protected get log() {
    return this.#logger
  }

  get isConnected(): boolean {
    return this.#client?.isConnected ?? false
  }

  async listen() {
    if (!this.#client) {
      this.#client = new IntervalClient(this, this.config)
    }
    return this.#client.listen()
  }

  close() {
    return this.#client?.close()
  }

  /* @internal */ get client() {
    return this.#client
  }

  async notify(config: NotifyConfig): Promise<void> {
    let body: z.infer<typeof NOTIFY['inputs']>
    try {
      body = NOTIFY.inputs.parse({
        ...config,
        deliveryInstructions: config.delivery,
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      this.#logger.debug(err)
      throw new IntervalError('Invalid input.')
    }

    if (!config.transactionId && this.environment === 'development') {
      this.#log.prod(
        'Calls to notify() outside of a transaction currently have no effect when Interval is instantiated with a development API key. Please use a live key to send notifications.'
      )
    }

    const response = await fetch(`${this.#httpEndpoint}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(r => NOTIFY.returns.parseAsync(r))
      .catch(err => {
        this.#logger.debug(err)
        throw new IntervalError('Received invalid API response.')
      })

    if (response.type === 'error') {
      throw new IntervalError(
        `There was a problem sending the notification: ${response.message}`
      )
    }
  }
}

export { Interval, IOError }
