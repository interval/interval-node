import createIntervalHost from '../index'

createIntervalHost({
  apiKey: '',
  actions: {
    'Hello world': async io => {
      const [first, last] = await io.renderGroup([
        io.input.text({ label: 'First name' }),
        io.input.text({ label: 'Last name' }),
      ])

      const hello = `Hello, ${first} ${last}`
      console.log(hello)

      io.render(
        io.display.heading({
          label: hello,
        })
      )
    },
  },
})
