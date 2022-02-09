import { IntervalActionHandler } from '..'

const unauthorized: IntervalActionHandler = async io => {
  const email = await io.input.email('Email address')

  if (!email.includes('@interval.com')) {
    throw new Error('Unauthorized')
  }

  const name = await io.input.text('Name')

  // Example multipart output
  return io.output.group(
    io.output.text(`Export complete`),
    io.output.button({
      label: 'Download data',
      url: 'https://intervalkit.com',
    }),
    io.output.keyValue({
      name,
      email,
    })
  )
}

export default unauthorized
