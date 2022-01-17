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
    },
    'Create a user account': async io => {
      const [first, last] = await io.inputGroup([
        io.ask.forText({ label: 'First' }),
        io.ask.forText({ label: 'Last' }),
      ])
      await io.input(
        io.display.heading({
          label: `You've created a user with name ${first} ${last}`,
        })
      )
    },
  },
})
