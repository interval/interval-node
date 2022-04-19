import { z } from 'zod'
import type { T_IO_PROPS, T_IO_RETURNS, T_IO_STATE } from '../ioSchema'
import IOError from '../classes/IOError'

type RenderResultDef =
  | string
  | {
      label: string
      description?: string
      imageUrl?: string
    }

type InternalResults = T_IO_PROPS<'SEARCH'>['results']

export default function search<Result = any>({
  onSearch,
  initialResults = [],
  placeholder,
  renderResult,
  helpText,
}: {
  placeholder?: string
  helpText?: string
  initialResults?: Result[]
  renderResult: (result: Result) => RenderResultDef
  onSearch: (query: string) => Promise<Result[]>
}) {
  // We maintain the last two batches of results to avoid race conditions regarding
  // host-side searching and client-side selection.
  // If this is too optimistic we can increase the number of remembered batches,
  // but more batches means more host memory usage.
  let resultBatchIndex = 0
  let resultMap: Map<string, Result[]> = new Map([['0', initialResults]])

  type Output = Result

  function renderResults(results: Result[]): InternalResults {
    return results.map((result, index) => {
      const r = renderResult(result)

      const value = `${resultBatchIndex}:${index}`

      if (r && typeof r === 'object' && !(r instanceof Date)) {
        return {
          ...r,
          value,
        }
      }

      return {
        value,
        label: r.toString(),
      }
    })
  }

  const props: T_IO_PROPS<'SEARCH'> = {
    placeholder,
    helpText,
    results: renderResults(initialResults),
  }

  return {
    props,
    getValue(response: T_IO_RETURNS<'SEARCH'>) {
      try {
        const [batchIndex, index] = response.split(':')
        const batch = resultMap.get(batchIndex)
        if (!batch) throw new IOError('BAD_RESPONSE')

        return batch[Number(index)] as Output
      } catch (err) {
        if (err instanceof IOError) throw err
        throw new IOError('BAD_RESPONSE')
      }
    },
    async onStateChange(newState: T_IO_STATE<'SEARCH'>) {
      const results = await onSearch(newState.queryTerm)

      resultMap.delete((resultBatchIndex - 1).toString())
      resultBatchIndex++
      const newIndex = resultBatchIndex.toString()
      resultMap.set(newIndex, results)

      return { results: renderResults(results) }
    },
  }
}
