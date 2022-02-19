import Interval from '../index'

const interval = new Interval({
  // TODO: update seed data with this API key
  apiKey: 'live_T31EqcPqmzWzZy2AegrE7wxKKvzDS1zqEfH4w6vq5R3o8jUE',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3002',
  actions: {
    enter_two_numbers: async io => {
      const num = await io.input.number('Enter a number')

      await io.input.number(
        `Enter a second number that's greater than ${num}`,
        {
          min: num + 1,
        }
      )
    },
    enter_one_number: async io => {
      const num = await io.input.number('Enter a number')
    },
  },
})

interval.listen()
