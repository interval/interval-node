import createIntervalHost from '../index'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

createIntervalHost({
  apiKey: '24367604-b35f-4b89-81bc-7d1cf549ba60',
  logLevel: 'debug',
  actions: {
    'For loop demo': async io => {
      console.log("Let's say hello...")

      await io.display.progressThroughList(
        ['Alex', 'Dan', 'Kyle', 'Ryan', 'Jacob'],
        async item => {
          const time = 5000 * item.length
          await sleep(time)
          return `Completed in ${time}ms`
        }
      )
    },
    'Create a user account': async io => {
      const [first, last] = await io.inputGroup([
        io.ask.forText({ label: 'First' }),
        io.ask.forText({ label: 'Last' }),
      ])

      await io.input(
        io.display.heading({
          label: `You created a user with name ${first} ${last}.`,
        })
      )
    },
  },
})
