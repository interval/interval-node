import http from 'http'
import { InternalConfig, Interval } from '..'

export async function handleRequest(requestId: string, config: InternalConfig) {
  const interval = new Interval(config)
  const response = await interval.respondToRequest(requestId)
  return response
}

export function createHttpServer(config: InternalConfig): http.Server {
  return http.createServer(createHttpRequestHandler(config))
}

export function createHttpRequestHandler(config: InternalConfig) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    // TODO: Proper headers
    // TODO: Some authentication somehow?

    if (req.method !== 'POST') {
      return res.writeHead(405).end()
    }

    try {
      const body = await getRequestBody(req)
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.writeHead(400).end()
      }

      const { requestId, httpHostId } = body

      if (requestId) {
        await handleRequest(requestId, config)
        return res.writeHead(200).end()
      } else if (httpHostId) {
        const interval = new Interval(config)
        await interval.declareHost(httpHostId)
        return res.writeHead(200).end()
      } else {
        return res.writeHead(400).end()
      }
    } catch (err) {
      console.error('Error in HTTP request handler:', err)
      return res.writeHead(500).end()
    }
  }
}

async function getRequestBody(req: http.IncomingMessage): Promise<any | null> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = []

    req.on('data', chunk => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      try {
        if (chunks.length === 0) return null

        resolve(JSON.parse(chunks.join()))
      } catch (err) {
        reject(err)
      }
    })

    req.on('error', err => {
      reject(err)
    })
  })
}
