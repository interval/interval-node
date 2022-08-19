import { z } from 'zod'
import { Evt } from 'evt'
import fetch from 'node-fetch'
import type { IncomingMessage, ServerResponse } from 'http'
import Interval, { io, ctx, InternalConfig, IntervalError } from '.'
import IntervalClient from './classes/IntervalClient'
import ActionGroup from './classes/ActionGroup'
import * as pkg from '../package.json'
import { DECLARE_HOST } from './internalRpcSchema'
import {
  getRequestBody,
  HttpRequestBody,
  LambdaRequestPayload,
  LambdaResponse,
} from './utils/http'
import Actions from './classes/Actions'
import { IntervalActionDefinition } from './types'

class ExperimentalInterval extends Interval {
  #groupChangeCtx = Evt.newCtx()
  actions: ExperimentalActions

  constructor(config: InternalConfig) {
    super(config)
    this.actions = new ExperimentalActions(
      this,
      this.httpEndpoint,
      this.log,
      this.apiKey
    )

    if (this.config.groups) {
      for (const group of Object.values(this.config.groups)) {
        group.onChange.attach(this.#groupChangeCtx, () => {
          this.client?.handleActionsChange(this.config)
        })
      }
    }
  }

  /*
   * Add an ActionGroup and its child actions to this deployment.
   */
  addGroup(prefix: string, group: ActionGroup) {
    if (!this.config.groups) {
      this.config.groups = {}
    }

    group.onChange.attach(this.#groupChangeCtx, () => {
      this.client?.handleActionsChange(this.config)
    })

    this.config.groups[prefix] = group

    this.client?.handleActionsChange(this.config)
  }

  removeGroup(prefix: string) {
    if (!this.config.groups) return

    const group = this.config.groups[prefix]
    if (!group) return

    group.onChange.detach(this.#groupChangeCtx)
    delete this.config.groups[prefix]
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
        interval.log.error('Error in HTTP request handler:', err)
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
            this.log.error('Failed parsing input body as JSON', event.body)
          }
        }

        if (!body) {
          return makeResponse(400)
        }

        const successful = await interval.handleRequest(body)
        return makeResponse(successful ? 200 : 500)
      } catch (err) {
        this.log.error('Error in Lambda handler', err)
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
      this.log.prod('No actions defined, skipping host declaration')
      return
    }

    const body: z.infer<typeof DECLARE_HOST['inputs']> = {
      httpHostId,
      actions,
      sdkName: pkg.name,
      sdkVersion: pkg.version,
    }

    const response = await fetch(`${this.httpEndpoint}/api/hosts/declare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(r => DECLARE_HOST.returns.parseAsync(r))
      .catch(err => {
        this.log.debug(err)
        throw new IntervalError('Received invalid API response.')
      })

    if (response.type === 'error') {
      throw new IntervalError(
        `There was a problem declaring the host: ${response.message}`
      )
    }

    if (response.sdkAlert) {
      this.log.handleSdkAlert(response.sdkAlert)
    }

    if (response.invalidSlugs.length > 0) {
      this.log.warn('[Interval]', '⚠ Invalid slugs detected:\n')

      for (const slug of response.invalidSlugs) {
        this.log.warn(`  - ${slug}`)
      }

      this.log.warn(
        '\nAction slugs must contain only letters, numbers, underscores, periods, and hyphens.'
      )

      if (response.invalidSlugs.length === slugs.length) {
        throw new IntervalError('No valid slugs provided')
      }
    }
  }
}

export class ExperimentalActions extends Actions {
  add(slug: string, action: IntervalActionDefinition) {
    if (!this.interval.config.actions) {
      this.interval.config.actions = {}
    }

    this.interval.config.actions[slug] = action
    this.interval.client?.handleActionsChange(this.interval.config)
  }

  remove(slug: string) {
    const { actions } = this.interval.config

    if (!actions) return
    const action = actions[slug]
    if (!action) return

    delete actions[slug]

    this.interval.client?.handleActionsChange(this.interval.config)
  }
}

export { ActionGroup, io, ctx, IntervalError, ExperimentalInterval as Interval }

export default ExperimentalInterval
