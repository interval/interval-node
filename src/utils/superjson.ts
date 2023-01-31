import superjson from 'superjson'

superjson.registerCustom(
  {
    isApplicable: (v: string): v is string =>
      typeof v === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(v),
    serialize: v => String(v),
    deserialize: v => String(v),
  },
  'time'
)

export default superjson
