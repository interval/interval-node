import path from 'path'
import fetch, { Response } from 'cross-fetch'
import { IntervalError } from '..'
import { T_IO_PROPS, T_IO_RETURNS, T_IO_STATE } from '../ioSchema'
import Logger from '../classes/Logger'

const MAX_RETRIES = 3

async function retryFetch(url: string): Promise<Response> {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const r = await fetch(url)
      return r
    } catch (err) {
      if (i === MAX_RETRIES) {
        throw err
      }
    }
  }

  // This should never happen, final failing response err would be thrown above
  throw new IntervalError('Failed to fetch file.')
}

type UploaderProps = T_IO_PROPS<'UPLOAD_FILE'> & {
  generatePresignedUrls?: (
    state: NonNullable<T_IO_STATE<'UPLOAD_FILE'>['files']>[0]
  ) => Promise<{ uploadUrl: string; downloadUrl: string }>
}

export function file(logger: Logger) {
  return function ({ generatePresignedUrls, ...props }: UploaderProps) {
    const isProvidingUrls = !!generatePresignedUrls
    return {
      props: {
        ...props,
        fileUrls: isProvidingUrls ? null : undefined,
      },
      getValue({ url, ...response }: T_IO_RETURNS<'UPLOAD_FILE'>) {
        return {
          ...response,
          lastModified: new Date(response.lastModified),
          get extension(): string {
            return path.extname(response.name)
          },
          async url(): Promise<string> {
            return url
          },
          async text(): Promise<string> {
            return retryFetch(url).then(r => r.text())
          },
          async json(): Promise<any> {
            return retryFetch(url).then(r => r.json())
          },
          async buffer(): Promise<Buffer> {
            return retryFetch(url)
              .then(r => r.arrayBuffer())
              .then(arrayBuffer => Buffer.from(arrayBuffer))
          },
        }
      },
      async onStateChange(newState: T_IO_STATE<'UPLOAD_FILE'>) {
        if (!generatePresignedUrls || !newState.files) {
          return { fileUrls: undefined }
        }

        return {
          fileUrls: await Promise.all(
            newState.files.map(fileState => generatePresignedUrls(fileState))
          ),
        }
      },
    }
  }
}
