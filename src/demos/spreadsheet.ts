import createIntervalHost from '../index'

createIntervalHost({
  apiKey: '24367604-b35f-4b89-81bc-7d1cf549ba60',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3002',
  actions: {
    'Import users': async io => {
      const data = await io.experimental.spreadsheet('Here are some items', {
        columns: ['firstName', 'lastName', { name: 'age', type: 'number?' }],
      })

      console.log('Data:', data)
    },
  },
})
