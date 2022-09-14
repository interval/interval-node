import { IntervalActionDefinition } from '@interval/sdk/src/types'
import { IntervalActionHandler } from '../..'
import { faker } from '@faker-js/faker'

function generateRows(count: number) {
  const rows: { [key: string]: string | number | boolean | Date }[] = []

  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      email: faker.internet.email(),
      description: faker.helpers.arrayElement([
        faker.random.word(),
        faker.random.words(),
        faker.lorem.paragraph(),
      ]),
      number: faker.datatype.number(100),
      boolean: faker.datatype.boolean(),
      date: faker.datatype.datetime(),
    })
  }

  return rows
}

export const no_pagination: IntervalActionHandler = async io => {
  const data = generateRows(5)

  await io.display.table('Display users', {
    data,
    defaultPageSize: 50,
  })
}

export const paginated: IntervalActionHandler = async io => {
  const data = generateRows(50)

  await io.display.table('Display users', {
    data,
    defaultPageSize: 10,
  })
}

export const large_table: IntervalActionDefinition = {
  name: '10k rows',
  handler: async io => {
    const data = generateRows(10_000)

    await io.display.table('Display users', {
      data,
      defaultPageSize: Infinity,
    })
  },
}

export const display_table: IntervalActionHandler = async io => {
  const data = generateRows(50)

  await io.display.table('Display users', {
    data,
    defaultPageSize: 50,
    columns: [
      'id',
      'description',
      'boolean',
      'date',
      {
        label: 'renderCell',
        renderCell: row =>
          `${String(row.description).split(' ')[0]} ${row.number}`,
      },
      {
        label: 'Link',
        renderCell: row => ({ href: '#', label: row.email }),
      },
    ],
    rowMenuItems: row => [
      {
        label: 'Edit',
        action: 'edit_user',
        params: { email: row.email },
      },
    ],
  })
}

export const select_table: IntervalActionHandler = async io => {
  faker.seed(0)

  const data = generateRows(50_000)

  const selected = await io.select.table('Display users', {
    data,
    defaultPageSize: 500,
    columns: [
      'id',
      'description',
      'number',
      'boolean',
      'date',
      {
        label: 'renderCell',
        renderCell: row =>
          `${String(row.description).split(' ')[0]} ${row.number}`,
      },
      {
        label: 'Link',
        renderCell: row => ({ href: '#', label: row.email }),
      },
    ],
    minSelections: 1,
    rowMenuItems: row => [
      {
        label: 'Edit',
        action: 'edit_user',
        params: { email: row.email },
      },
    ],
  })

  await io.display.table('Display users', {
    data: selected,
    columns: [
      'string',
      'number',
      'boolean',
      'date',
      {
        label: 'renderCell',
        renderCell: row => `${row.string} ${row.number}`,
      },
      {
        label: 'Edit',
        renderCell: row => ({ href: '#', label: row.string }),
      },
    ],
  })
}

export const table_custom: IntervalActionHandler = async io => {
  const options = [
    'id',
    'name',
    'email',
    'url',
    'number',
    'paragraph',
    'address1',
    'address2',
    'city',
    'state',
    'zip',
  ].map(f => ({ label: f, value: f }))

  const [rowsCount, fields, tableType, orientation] = await io.group([
    io.input.number('Number of rows', { defaultValue: 50 }),
    io.select.multiple('Fields', {
      options: options,
      defaultValue: options,
    }),
    io.select.single('Table type', {
      options: [
        { label: 'Display', value: 'display' },
        { label: 'Select', value: 'select' },
      ],
      defaultValue: { label: 'Display', value: 'display' },
    }),
    io.select.single('Orientation', {
      options: [
        { label: 'Horizontal', value: 'horizontal' },
        { label: 'Vertical', value: 'vertical' },
      ],
      defaultValue: { label: 'Horizontal', value: 'horizontal' },
      helpText:
        'Warning: Vertical orientation is not supported for select tables; it will be ignored',
    }),
  ])

  const rows: { [key: string]: any }[] = []
  for (let i = 0; i < rowsCount; i++) {
    const row: typeof rows[0] = {}
    for (const field of fields) {
      switch (field.value) {
        case 'id':
          row[field.value] = faker.datatype.uuid()
          break
        case 'name':
          row[field.value] = faker.name.findName()
          break
        case 'email':
          row[field.value] = faker.internet.email()
          break
        case 'url':
          row[field.value] = faker.internet.url()
          break
        case 'number':
          row[field.value] = faker.datatype.number()
          break
        case 'paragraph':
          row[field.value] = faker.lorem.paragraph()
          break
        case 'address1':
          row[field.value] = faker.address.streetAddress()
          break
        case 'address2':
          row[field.value] = faker.address.secondaryAddress()
          break
        case 'city':
          row[field.value] = faker.address.city()
          break
        case 'state':
          row[field.value] = faker.address.state()
          break
        case 'zip':
          row[field.value] = faker.address.zipCode()
          break
        default:
          break
      }
    }
    rows.push(row)
  }

  if (tableType.value === 'display') {
    await io.display.table('Table', {
      data: rows,
      orientation: orientation.value as 'horizontal' | 'vertical',
    })
  } else {
    const [selections] = await io.select.table('Select a person', {
      data: rows,
      minSelections: 1,
      maxSelections: 3,
    })
    await io.display.object('Selected', { data: selections })
  }
}
