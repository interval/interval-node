import { IntervalActionHandler } from '..'

const unauthorized: IntervalActionHandler = async io => {
  const email = await io.input.email('Email address')

  if (!email.includes('@interval.com')) {
    throw new Error('Unauthorized')
  }

  const name = await io.input.text('Name')

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

  return io.output.button({})

  return [
    {
      type: 'text',
      contents: 'Export complete',
    },
    {
      type: 'button',
      label: 'https://intervalkit.com',
      url: 'Download data',
    },
    {
      type: 'keyValue',
      data: { name, email },
    },
  ]

  // const email = await io.input.email('Email')

  // return {
  //   'Download URL': 'https://google.com',
  // }




  return {
    status: 'success',
    data: {
      'Download zip': 'https://intervalexports.com/data.zip',
      message: 'This link expires in 10 minutes.',
      Classes: '12',
      Memberships: '15',
      'Class Packs': '0',
    },
  }




  // return io.output.text(`Email: ${email}`)
}

export default unauthorized
