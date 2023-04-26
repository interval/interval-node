import type { Evt } from 'evt'
import {
  T_IO_PROPS,
  Serializable,
  SerializableRecord,
  ImageSchema,
} from '../ioSchema'
import { EventualValue } from '../types'

export interface EventualMetaItem {
  label: string
  value?: EventualValue<Serializable>
  url?: EventualValue<string>
  image?: EventualValue<ImageSchema>
  route?: EventualValue<string>
  /** @deprecated Please use `route` instead */
  action?: EventualValue<string>
  params?: EventualValue<SerializableRecord>
}

export default function displayMetadata(
  props: Pick<T_IO_PROPS<'DISPLAY_METADATA'>, 'layout'> & {
    data: EventualMetaItem[]
  },
  onPropsUpdate?: Evt<T_IO_PROPS<'DISPLAY_METADATA'>>
): { props: T_IO_PROPS<'DISPLAY_METADATA'> } {
  const layout = props.layout
  const metaItems: EventualMetaItem[] = []
  const data: T_IO_PROPS<'DISPLAY_METADATA'>['data'] = props.data.map(
    metaItem => {
      metaItem = { ...metaItem }

      const initialItem: T_IO_PROPS<'DISPLAY_METADATA'>['data'][0] = {
        label: metaItem.label,
      }

      if ('value' in metaItem) {
        if (typeof metaItem.value === 'function') {
          metaItem.value = metaItem.value()
        }

        if (!(metaItem.value instanceof Promise)) {
          initialItem.value = metaItem.value
        }
      }

      if ('url' in metaItem) {
        if (typeof metaItem.url === 'function') {
          metaItem.url = metaItem.url()
        }

        if (!(metaItem.url instanceof Promise)) {
          initialItem.url = metaItem.url
        }
      }

      if ('image' in metaItem) {
        if (typeof metaItem.image === 'function') {
          metaItem.image = metaItem.image()
        }

        if (!(metaItem.image instanceof Promise)) {
          initialItem.image = metaItem.image
        }
      }

      if ('route' in metaItem) {
        if (typeof metaItem.route === 'function') {
          metaItem.route = metaItem.route()
        }

        if (!(metaItem.route instanceof Promise)) {
          initialItem.route = metaItem.route
        }
      }

      if ('action' in metaItem) {
        if (typeof metaItem.action === 'function') {
          metaItem.action = metaItem.action()
        }

        if (!(metaItem.action instanceof Promise)) {
          initialItem.action = metaItem.action
        }
      }

      if ('params' in metaItem) {
        if (typeof metaItem.params === 'function') {
          metaItem.params = metaItem.params()
        }

        if (!(metaItem.params instanceof Promise)) {
          initialItem.params = metaItem.params
        }
      }

      metaItems.push(metaItem)

      return initialItem
    }
  )

  if (onPropsUpdate) {
    for (let i = 0; i < metaItems.length; i++) {
      const metaItem = metaItems[i]

      if ('value' in metaItem) {
        if (metaItem.value instanceof Promise) {
          metaItem.value.then(resolvedValue => {
            data[i].value = resolvedValue
            onPropsUpdate?.post({
              layout,
              data,
            })
          })
        }
      }

      if ('url' in metaItem) {
        if (metaItem.url instanceof Promise) {
          metaItem.url.then(resolvedurl => {
            data[i].url = resolvedurl
            onPropsUpdate?.post({
              layout,
              data,
            })
          })
        }
      }

      if ('image' in metaItem) {
        if (metaItem.image instanceof Promise) {
          metaItem.image.then(resolvedimage => {
            data[i].image = resolvedimage
            onPropsUpdate?.post({
              layout,
              data,
            })
          })
        }
      }

      if ('route' in metaItem) {
        if (metaItem.route instanceof Promise) {
          metaItem.route.then(resolvedroute => {
            data[i].route = resolvedroute
            onPropsUpdate?.post({
              layout,
              data,
            })
          })
        }
      }

      if ('action' in metaItem) {
        if (metaItem.action instanceof Promise) {
          metaItem.action.then(resolvedaction => {
            data[i].action = resolvedaction
            onPropsUpdate?.post({
              layout,
              data,
            })
          })
        }
      }

      if ('params' in metaItem) {
        if (metaItem.params instanceof Promise) {
          metaItem.params.then(resolvedparams => {
            data[i].params = resolvedparams
            onPropsUpdate?.post({
              layout,
              data,
            })
          })
        }
      }
    }
  }

  return {
    props: {
      data,
      layout,
    },
  }
}
