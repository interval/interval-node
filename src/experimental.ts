import { z } from 'zod'
import fetch from 'cross-fetch'
import type { IncomingMessage, ServerResponse } from 'http'
import Interval, { io, ctx, InternalConfig, IntervalError } from '.'
import IntervalClient from './classes/IntervalClient'
import Page from './classes/Page'
import * as pkg from '../package.json'
import { DECLARE_HOST } from './internalRpcSchema'
import {
  getRequestBody,
  HttpRequestBody,
  LambdaRequestPayload,
  LambdaResponse,
} from './utils/http'
import Action from './classes/Action'
import { BasicLayout } from './classes/Layout'

class ExperimentalInterval extends Interval {
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

    client.immediatelyClose()

    return response
  }

  async #declareHost(httpHostId: string) {
    const client = new IntervalClient(this, this.config)
    const response = await client.declareHost(httpHostId)

    client.immediatelyClose()

    return response
  }
}

export {
  Page,
  // TODO: Mark as deprecated soon, remove soon afterward
  Page as ActionGroup,
  Page as Router,
  Action,
  io,
  ctx,
  IntervalError,
  ExperimentalInterval as Interval,
  BasicLayout as Layout,
}

export default ExperimentalInterval
