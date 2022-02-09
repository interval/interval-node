import { IntervalActionHandler } from '..'

const unauthorized: IntervalActionHandler = async io => {
  const email = await io.input.email('Email address')

  if (!email.includes('@interval.com')) {
    throw new Error('Unauthorized')
  }

  const name = await io.input.text('Name')

  return {
    name,
    email,
    'Download data': 'https://intervalkit.com/export.zip',
  }
}

export default unauthorized
