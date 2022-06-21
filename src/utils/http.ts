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
