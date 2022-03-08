import { DeserializableRecord, SerializableRecord } from '../ioSchema'

export function serializeDates(
  record: SerializableRecord
): DeserializableRecord {
  const ret: DeserializableRecord = {}

  for (const [key, val] of Object.entries(record)) {
    if (val instanceof Date) {
      ret[key] = val.toISOString()
    } else {
      ret[key] = val
    }
  }

  return ret
}

export function deserializeDates(
  record: DeserializableRecord | SerializableRecord
): SerializableRecord {
  const ret: SerializableRecord = {}

  for (const [key, val] of Object.entries(record)) {
    if (typeof val === 'string') {
      const date = new Date(val)
      if (date.toJSON() === val) {
        ret[key] = date
      } else {
        ret[key] = val
      }
    } else {
      ret[key] = val
    }
  }

  return ret
}
