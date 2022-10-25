import { IntervalActionDefinition } from '@interval/sdk/src/types'
import { IntervalActionHandler } from '../..'
import { faker } from '@faker-js/faker'

function generateRows(count: number, offset = 0) {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      id: offset + i,
      name: `${faker.name.firstName()} ${faker.name.lastName()}`,
      email: faker.internet.email(),
      description: faker.helpers.arrayElement([
        faker.random.word(),
        faker.random.words(),
        faker.lorem.paragraph(),
      ]),
      number: faker.datatype.number(100),
      boolean: faker.datatype.boolean(),
      date: faker.datatype.datetime(),
      image: faker.image.imageUrl(
        480,
        Math.random() < 0.25 ? 300 : 480,
        undefined,
        true
      ),
      array: Array(10)
        .fill(null)
        .map(() => faker.word.noun()),
    }))
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
  const data = generateRows(200)

  await io.display.table('Display users', {
    data,
    defaultPageSize: 50,
    columns: [
      'id',
      {
        label: 'User',
        renderCell: row => ({
          label: row.name,
          image: {
            alt: 'Alt tag',
            url: row.image,
            size: 'small',
          },
        }),
      },
      {
        label: 'Description',
        accessorKey: 'description',
      },
      'boolean',
      'date',
      'array',
      {
        label: 'renderCell',
        renderCell: row =>
          `${String(row.description).split(' ')[0]} ${row.number}`,
      },
      {
        label: 'Link',
        renderCell: row => ({ url: '#', label: row.email }),
      },
    ],
    rowMenuItems: row => [
      {
        label: 'Edit',
        route: 'edit_user',
        params: { email: row.email },
      },
      {
        label: 'Edit',
        route: 'edit_user',
        params: { email: row.email },
        disabled: true,
      },
      {
        label: 'Delete',
        route: 'delete_user',
        params: { email: row.email },
        theme: 'danger',
      },
      {
        label: 'Delete',
        route: 'delete_user',
        params: { email: row.email },
        theme: 'danger',
        disabled: true,
      },
    ],
  })
}

export const multiple_tables: IntervalActionHandler = async io => {
  await io.group([
    io.display.table('Display users', {
      data: generateRows(10),
      defaultPageSize: 10,
    }),
    io.display.table('Display users', {
      data: generateRows(10),
      defaultPageSize: 10,
    }),
    io.display.table('Display users', {
      data: generateRows(10),
      defaultPageSize: 10,
    }),
    io.display.table('Display users', {
      data: generateRows(10),
      defaultPageSize: 10,
    }),
    io.display.table('Display users', {
      data: generateRows(10),
      defaultPageSize: 10,
    }),
  ])
}

export const async_table: IntervalActionHandler = async io => {
  const allData = generateRows(500)
  await io.display.table<ReturnType<typeof generateRows>[0]>('Display users', {
    async getData({ queryTerm, sortColumn, sortDirection, offset, pageSize }) {
      let filteredData = allData.slice()

      if (queryTerm) {
        const re = new RegExp(queryTerm, 'i')

        filteredData = filteredData.filter(row => {
          return (
            re.test(row.name) || re.test(row.email) || re.test(row.description)
          )
        })
      }

      if (sortColumn && sortDirection) {
        filteredData.sort((a, b) => {
          if (sortDirection === 'desc') {
            const temp = b
            b = a
            a = temp
          }

          if (!(sortColumn in a) || !(sortColumn in b)) return 0

          const aVal = a[sortColumn as keyof typeof a]
          const bVal = b[sortColumn as keyof typeof b]

          if (aVal < bVal) return -1
          if (aVal > bVal) return 1
          return 0
        })
      }

      return {
        data: filteredData.slice(offset, offset + pageSize),
        totalRecords: filteredData.length,
      }
    },
    defaultPageSize: 50,
    columns: [
      'id',
      {
        label: 'User',
        renderCell: row => ({
          label: row.name,
          image: {
            alt: 'Alt tag',
            url: row.image,
            size: 'small',
          },
        }),
      },
      {
        label: 'Email',
        accessorKey: 'email',
      },
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
        renderCell: row => ({ url: '#', label: row.email }),
      },
    ],
    rowMenuItems: row => [
      {
        label: 'Edit',
        route: 'edit_user',
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
      {
        label: 'Description',
        accessorKey: 'description',
      },
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
        renderCell: row => ({ url: '#', label: row.email }),
      },
    ],
    minSelections: 1,
    rowMenuItems: row => [
      {
        label: 'Edit',
        route: 'edit_user',
        params: { email: row.email },
      },
    ],
  })

  await io.display.table('Display users', {
    data: selected,
    columns: [
      'description',
      'number',
      'boolean',
      'date',
      {
        label: 'renderCell',
        renderCell: row => `${row.description} ${row.number}`,
      },
      {
        label: 'Edit',
        renderCell: row => ({ url: '#', label: row.email }),
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

  const [
    rowsCount,
    fields,
    tableType,
    orientation,
    minSelections,
    maxSelections,
  ] = await io.group([
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
    io.input
      .number('Min selection', {
        min: 0,
      })
      .optional(),
    io.input
      .number('Max selection', {
        min: 0,
      })
      .optional(),
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
      minSelections,
      maxSelections,
    })
    await io.display.object('Selected', { data: selections })
  }
}

export const image_viewer: IntervalActionHandler = async io => {
  const data = Array(50)
    .fill(null)
    .map((_, i) => {
      const [width, height, crazyW, crazyH] = [
        faker.datatype.number({ min: 500, max: 700 }),
        faker.datatype.number({ min: 200, max: 400 }),
        faker.datatype.number({ min: 100, max: 999 }),
        faker.datatype.number({ min: 100, max: 999 }),
      ]

      return {
        id: i,
        name: faker.name.findName(),
        square: faker.image.avatar(),
        width,
        height,
        crazyW,
        crazyH,
        wide: faker.image.imageUrl(width, height, undefined, true),
        tall: faker.image.imageUrl(height, width, undefined, true),
        crazy: faker.image.imageUrl(crazyW, crazyH, undefined, true),
      }
    })

  await io.display.table('Images', {
    data,
    defaultPageSize: 50,
    columns: [
      'id',
      {
        label: 'Square',
        renderCell: row => ({
          image: {
            alt: 'Alt tag',
            url: row.square,
            size: 'small',
          },
        }),
      },
      {
        label: 'Tall',
        renderCell: row => ({
          label: `${row.height} x ${row.width}`,
          image: {
            alt: 'Alt tag',
            url: row.tall,
            size: 'small',
          },
        }),
      },
      {
        label: 'Wide',
        renderCell: row => ({
          label: `${row.width} x ${row.height}`,
          image: {
            alt: 'Alt tag',
            url: row.wide,
            size: 'small',
          },
        }),
      },
      {
        label: 'Crazy',
        renderCell: row => ({
          label: `${row.crazyW} x ${row.crazyH}`,
          image: {
            alt: 'Alt tag',
            url: row.crazy,
            size: 'small',
          },
        }),
      },
    ],
  })

  await io.display.table('Image sizes', {
    data,
    defaultPageSize: 50,
    columns: [
      'id',
      {
        label: 'Thumbnail',
        renderCell: row => ({
          image: {
            alt: 'Alt tag',
            url: row.wide,
            size: 'thumbnail',
          },
        }),
      },
      {
        label: 'Small',
        renderCell: row => ({
          image: {
            alt: 'Alt tag',
            url: row.wide,
            size: 'small',
          },
        }),
      },
      {
        label: 'Medium',
        renderCell: row => ({
          image: {
            alt: 'Alt tag',
            url: row.wide,
            size: 'medium',
          },
        }),
      },
      {
        label: 'Large',
        renderCell: row => ({
          image: {
            alt: 'Alt tag',
            url: row.wide,
            size: 'large',
          },
        }),
      },
    ],
  })
}
