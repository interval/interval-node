import { IncomingMessage } from 'http'

export async function getRequestBody(
  req: IncomingMessage
): Promise<any | null> {
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

export interface HttpRequestBody {
  requestId?: string
  httpHostId?: string
}

/*
 * A very slim Lambda request payload interface with just the parts we care about right now.
 */
export interface LambdaRequestPayload {
  version: '2.0'
  requestContext: {
    http: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS'
    }
  }
  body?: string
}

export interface LambdaResponse {
  isBase64Encoded: boolean
  statusCode: number
  headers: Record<string, string>
  body: string
}
