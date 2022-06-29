// TODO: Remove this when all active SDKs support superjson

export function serializeDates<V extends any>(
  record: Record<string, V>
): Record<string, Exclude<V, Date> | string> {
  type Dateless = Exclude<V, Date>
  const ret: Record<string, Dateless | string> = {}

  for (const [key, val] of Object.entries(record)) {
    if (val instanceof Date) {
      ret[key] = val.toISOString()
    } else if (val && typeof val === 'object') {
      if (Array.isArray(val)) {
        ret[key] = val.map(v => serializeDates(v)) as Dateless
      } else {
        try {
          ret[key] = serializeDates(val as Record<string, V>) as Dateless
        } catch {}
      }
    } else {
      ret[key] = val as Exclude<V, Date>
    }
  }

  return ret
}

export function deserializeDates<V extends any>(
  record: Record<string, V>
): Record<string, V | Date> {
  const ret: Record<string, V | Date> = {}

  for (const [key, val] of Object.entries(record)) {
    if (typeof val === 'string') {
      const date = new Date(val)
      if (date.toJSON() === val) {
        ret[key] = date
      } else {
        ret[key] = val
      }
    } else if (val && typeof val === 'object' && !(val instanceof Date)) {
      if (Array.isArray(val)) {
        ret[key] = val.map(v => deserializeDates(v)) as V
      } else {
        try {
          ret[key] = deserializeDates(val as Record<string, V>) as V
        } catch {
          ret[key] = val
        }
      }
    } else {
      ret[key] = val
    }
  }

  return ret
}

export function stripUndefined<
  K extends string | number | symbol,
  V,
  T extends Record<K, V> | undefined
>(obj: T): T {
  if (!obj) return obj

  const newObj = { ...obj } as Exclude<typeof obj, undefined>
  for (const [key, val] of Object.entries(newObj)) {
    if (val === undefined) {
      delete newObj[key as K]
    }
  }

  return newObj
}
