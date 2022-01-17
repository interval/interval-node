import createIntervalHost from '../index'

createIntervalHost({
  apiKey: '24367604-b35f-4b89-81bc-7d1cf549ba60',
  actions: {
    'Say hello': async io => {
      console.log("Let's say hello...")

      let [, first, last] = await io.inputGroup([
        io.component('DISPLAY_HEADING', { label: 'Welcome' }),
        // io.component('ASK_CONFIRM', { question: 'how are you' }),
        io.component('ASK_TEXT', { label: 'First name' }),
        io.component('ASK_TEXT', { label: 'Last name' }),
      ])

      while (first.includes(' ')) {
        first = await io.input(
          io.component('ASK_TEXT', {
            label: 'First names cannot include spaces, try again?',
          })
        )
      }

      console.log('result', first, last)
      const areYouSure = await io.input(
        io.component('ASK_TEXT', { label: 'How are you?' })
      )

      console.log('u sure?', areYouSure)
    },
  },
})
