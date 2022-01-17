import createIntervalHost from '../index'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

createIntervalHost({
  apiKey: '24367604-b35f-4b89-81bc-7d1cf549ba60',
  actions: {
    'For loop demo': async io => {
      console.log("Let's say hello...")

      await io.forEach(['Alex', 'Dan', 'Kyle', 'Ryan', 'Jacob'], async item => {
        console.log('hi!')
        await sleep(500 * item.length)
      })

      // let [, first, last] = await io.inputGroup([
      //   io.component('DISPLAY_HEADING', { label: 'Welcome' }),
      //   // io.component('ASK_CONFIRM', { question: 'how are you' }),
      //   io.component('ASK_TEXT', { label: 'First name' }),
      //   io.component('ASK_TEXT', { label: 'Last name' }),
      // ])

      // io.input(io.component('DISPLAY_HEADING', { label: 'Loading...' }))
      // await sleep(5000)

      // while (first.includes(' ')) {
      //   first = await io.input(
      //     io.component('ASK_TEXT', {
      //       label: 'First names cannot include spaces, try again?',
      //     })
      //   )
      // }

      // console.log('result', first, last)
      // const areYouSure = await io.input(
      //   io.component('ASK_TEXT', { label: 'How are you?' })
      // )

      // console.log('u sure?', areYouSure)
    },
    'Create a user account': async io => {
      const [first, last] = await io.inputGroup([
        io.component('ASK_TEXT', { label: 'First' }),
        io.component('ASK_TEXT', { label: 'Last' }),
      ])
      await io.input(
        io.component('DISPLAY_HEADING', {
          label: `You've created a user with name ${first} ${last}`,
        })
      )
    },
  },
})
