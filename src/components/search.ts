import type {
  ImageSchema,
  T_IO_PROPS,
  T_IO_RETURNS,
  T_IO_STATE,
} from '../ioSchema'
import IOError from '../classes/IOError'

type RenderResultDef =
  | string
  | number
  | boolean
  | Date
  | {
      label: string | number | boolean | Date
      description?: string
      image?: ImageSchema
      /**
       * @deprecated Deprecated in favor of `image.url`.
       */
      imageUrl?: string
    }

type InternalResults = T_IO_PROPS<'SEARCH'>['results']
type DefaultValue = T_IO_PROPS<'SEARCH'>['defaultValue']

export default function search<Result = any>({
  onSearch,
  initialResults = [],
  defaultValue,
  renderResult,
  disabled = false,
  ...rest
}: {
  placeholder?: string
  helpText?: string
  disabled?: boolean
  initialResults?: Result[]
  defaultValue?: Result
  renderResult: (result: Result) => RenderResultDef
  onSearch: (query: string) => Promise<Result[]>
}) {
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

  const results = renderResults(initialResults)

  function getDefaultValue(defaultValue: Result): DefaultValue {
    let defaultResults = resultMap.get('default')
    if (!defaultResults) {
      defaultResults = []
      resultMap.set('default', defaultResults)
    }
    const r = renderResult(defaultValue)
    const value = `default:${defaultResults.length}`
    defaultResults.push(defaultValue)

    if (r && typeof r == 'object' && !(r instanceof Date)) {
      results.push({
        ...r,
        value,
      })
    } else {
      results.push({
        value,
        label: r.toString(),
      })
    }

    return value
  }

  const props: T_IO_PROPS<'SEARCH'> = {
    ...rest,
    defaultValue: defaultValue ? getDefaultValue(defaultValue) : undefined,
    results,
    disabled,
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
    getDefaultValue,
    async onStateChange(newState: T_IO_STATE<'SEARCH'>) {
      const results = await onSearch(newState.queryTerm)

      resultBatchIndex++
      const newIndex = resultBatchIndex.toString()
      resultMap.set(newIndex, results)

      return { results: renderResults(results) }
    },
  }
}
