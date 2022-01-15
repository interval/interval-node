import createIntervalHost from '../index'

createIntervalHost({
  apiKey: '24367604-b35f-4b89-81bc-7d1cf549ba60',
  actions: {
    'Say hello': async io => {
      console.log("Let's say hello...")
      const name = await io('ASK_TEXT', { label: 'What is your name?' })
      console.log(`Hello, ${name}`)
    },
  },
})
