import Interval from '../index'

const interval = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3002',
  actions: {
    enter_two_numbers: async io => {
      const num1 = await io.input.number('Enter a number')

      const num2 = await io.input.number(
        `Enter a second number that's greater than ${num1}`,
        {
          min: num1 + 1,
        }
      )

      return { num1, num2 }
    },
    enter_one_number: async io => {
      const num = await io.input.number('Enter a number')

      return { num }
    },
  },
})

interval.listen()
