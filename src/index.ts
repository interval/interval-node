import { z } from 'zod'
import type { IncomingMessage, ServerResponse } from 'http'
import fetch from 'node-fetch'
import IOError from './classes/IOError'
import Logger from './classes/Logger'
import {
  ENQUEUE_ACTION,
  DEQUEUE_ACTION,
  NOTIFY,
  ActionEnvironment,
  DECLARE_HOST,
} from './internalRpcSchema'
import { SerializableRecord } from './ioSchema'
import * as pkg from '../package.json'
import type {
  ActionCtx,
  ActionLogFn,
  IO,
  IntervalActionHandler,
  IntervalActionDefinition,
  IntervalActionStore,
  NotifyConfig,
} from './types'
import IntervalClient, {
  DEFAULT_WEBSOCKET_ENDPOINT,
  getHttpEndpoint,
  actionLocalStorage,
} from './classes/IntervalClient'
import {
  getRequestBody,
  HttpRequestBody,
  LambdaRequestPayload,
  LambdaResponse,
} from './utils/http'

export type {
  ActionCtx,
  ActionLogFn,
  IO,
  IntervalActionHandler,
  IntervalActionStore,
}

export interface InternalConfig {
  apiKey?: string
  actions?: Record<string, IntervalActionDefinition>
  endpoint?: string
  logLevel?: 'prod' | 'debug'
  retryIntervalMs?: number
  pingIntervalMs?: number
  closeUnresponsiveConnectionTimeoutMs?: number
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
  actions: Actions

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
    this.actions = new Actions(this.#httpEndpoint, this.#logger, this.#apiKey)
  }

  get #log() {
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

  /*
   * Handle a serverless host endpoint request. Receives the deserialized request body object.
   */
  async handleRequest({
    requestId,
    httpHostId,
  }: HttpRequestBody): Promise<boolean> {
    if (requestId) {
      await this.#respondToRequest(requestId)
      return true
    } else if (httpHostId) {
      await this.#declareHost(httpHostId)
      return true
    } else {
      return false
    }
  }

  // A getter that returns a function instead of a method to avoid `this` binding issues.
  get httpRequestHandler() {
    const interval = this

    return async (req: IncomingMessage, res: ServerResponse) => {
      // TODO: Proper headers

      if (req.method === 'GET') {
        return res.writeHead(200).end('OK')
      }

      if (req.method !== 'POST') {
        return res.writeHead(405).end()
      }

      try {
        const body = await getRequestBody(req)
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return res.writeHead(400).end()
        }

        const successful = await interval.handleRequest(body)
        return res.writeHead(successful ? 200 : 400).end()
      } catch (err) {
        console.error('Error in HTTP request handler:', err)
        return res.writeHead(500).end()
      }
    }
  }

  // A getter that returns a function instead of a method to avoid `this` binding issues.
  get lambdaRequestHandler() {
    const interval = this

    return async (event: LambdaRequestPayload) => {
      function makeResponse(
        statusCode: number,
        body?: Record<string, string> | string
      ): LambdaResponse {
        return {
          isBase64Encoded: false,
          statusCode,
          body: body
            ? typeof body === 'string'
              ? body
              : JSON.stringify(body)
            : '',
          headers:
            body && typeof body !== 'string'
              ? {
                  'content-type': 'application/json',
                }
              : {},
        }
      }

      if (event.requestContext.http.method === 'GET') {
        return makeResponse(200)
      }

      if (event.requestContext.http.method !== 'POST') {
        return makeResponse(405)
      }

      try {
        let body: HttpRequestBody | undefined
        if (event.body) {
          try {
            body = JSON.parse(event.body)
          } catch (err) {
            console.error('Failed parsing input body as JSON', event.body)
          }
        }

        if (!body) {
          return makeResponse(400)
        }

        return interval.handleRequest(body)
      } catch (err) {
        console.error('Error in Lambda handler', err)
        return makeResponse(500)
      }
    }
  }

  /**
   * Always creates a new host connection to Interval and uses it only for the single request.
   */
  async #respondToRequest(requestId: string) {
    if (!requestId) {
      throw new Error('Missing request ID')
    }

    const client = new IntervalClient(this, this.config)
    const response = await client.respondToRequest(requestId)

    client.close()

    return response
  }

  async #declareHost(httpHostId: string) {
    const actions = Object.entries(this.config.actions ?? {}).map(
      ([slug, def]) => ({
        slug,
        ...('handler' in def ? def : {}),
        handler: undefined,
      })
    )
    const slugs = actions.map(a => a.slug)

    if (slugs.length === 0) {
      this.#log.prod('No actions defined, skipping host declaration')
      return
    }

    const body: z.infer<typeof DECLARE_HOST['inputs']> = {
      httpHostId,
      actions,
      sdkName: pkg.name,
      sdkVersion: pkg.version,
    }

    const response = await fetch(`${this.#httpEndpoint}/api/hosts/declare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(r => DECLARE_HOST.returns.parseAsync(r))
      .catch(err => {
        this.#logger.debug(err)
        throw new IntervalError('Received invalid API response.')
      })

    if (response.type === 'error') {
      throw new IntervalError(
        `There was a problem declaring the host: ${response.message}`
      )
    }

    if (response.sdkAlert) {
      this.#log.handleSdkAlert(response.sdkAlert)
    }

    if (response.invalidSlugs.length > 0) {
      this.#log.warn('[Interval]', '⚠ Invalid slugs detected:\n')

      for (const slug of response.invalidSlugs) {
        this.#log.warn(`  - ${slug}`)
      }

      this.#log.warn(
        '\nAction slugs must contain only letters, numbers, underscores, periods, and hyphens.'
      )

      if (response.invalidSlugs.length === slugs.length) {
        throw new IntervalError('No valid slugs provided')
      }
    }
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

/**
 * This is effectively a namespace inside of Interval with a little bit of its own state.
 */
class Actions {
  #logger: Logger
  #apiKey?: string
  #endpoint: string

  constructor(endpoint: string, logger: Logger, apiKey?: string) {
    this.#apiKey = apiKey
    this.#logger = logger
    this.#endpoint = endpoint + '/api/actions'
  }

  #getAddress(path: string): string {
    if (path.startsWith('/')) {
      path = path.substring(1)
    }

    return `${this.#endpoint}/${path}`
  }

  async enqueue(
    slug: string,
    config: Pick<QueuedAction, 'assignee' | 'params'> = {}
  ): Promise<QueuedAction> {
    let body: z.infer<typeof ENQUEUE_ACTION['inputs']>
    try {
      body = ENQUEUE_ACTION.inputs.parse({
        ...config,
        slug,
      })
    } catch (err) {
      this.#logger.debug(err)
      throw new IntervalError('Invalid input.')
    }

    const response = await fetch(this.#getAddress('enqueue'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(r => ENQUEUE_ACTION.returns.parseAsync(r))
      .catch(err => {
        this.#logger.debug(err)
        throw new IntervalError('Received invalid API response.')
      })

    if (response.type === 'error') {
      throw new IntervalError(
        `There was a problem enqueuing the action: ${response.message}`
      )
    }

    return {
      id: response.id,
      ...config,
    }
  }

  async dequeue(id: string): Promise<QueuedAction> {
    let body: z.infer<typeof DEQUEUE_ACTION['inputs']>
    try {
      body = DEQUEUE_ACTION.inputs.parse({
        id,
      })
    } catch (err) {
      this.#logger.debug(err)
      throw new IntervalError('Invalid input.')
    }

    const response = await fetch(this.#getAddress('dequeue'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(r => DEQUEUE_ACTION.returns.parseAsync(r))
      .catch(err => {
        this.#logger.debug(err)
        throw new IntervalError('Received invalid API response.')
      })

    if (response.type === 'error') {
      throw new IntervalError(
        `There was a problem enqueuing the action: ${response.message}`
      )
    }

    const { type, ...rest } = response

    return rest
  }
}

export { Interval, IOError }
