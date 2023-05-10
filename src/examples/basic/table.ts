import { IntervalActionDefinition } from '@interval/sdk/src/types'
import { IntervalActionHandler, Action, Page, Layout, io } from '../..'
import { faker } from '@faker-js/faker'
import fakeUsers from '../utils/fakeUsers'
import { generateRows } from '../utils/helpers'
import { asyncTable } from '../utils/ioMethodWrappers'
import dedent from 'dedent'
import { HighlightColor } from '../../ioSchema'

export const no_pagination: IntervalActionHandler = async io => {
  const data = generateRows(5)

  await io.display.table('Display users', {
    data,
    defaultPageSize: 50,
    isFilterable: false,
    isSortable: false,
    rowMenuItems: () => [],
  })
}

export const paginated: IntervalActionHandler = async io => {
  const data = generateRows(50)

  await io.display.table('Display users', {
    data,
    defaultPageSize: 10,
  })
}

export const empty: IntervalActionHandler = async io => {
  const data = generateRows(5)

  await io.display.table('Display users', {
    columns: ['id', 'name', 'email'],
    data: data.slice(0, 0),
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
          highlightColor: 'blue',
        }),
      },
      {
        label: 'Email',
        accessorKey: 'email',
        renderCell: row => ({
          label: row.email,
          url: `mailto:${row.email}`,
        }),
      },
      {
        label: 'Description',
        accessorKey: 'description',
        renderCell: row => ({
          label: row.description,
          truncate: 50,
        }),
      },
      'boolean',
      'date',
      'array',
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
      {
        label: 'External',
        url: 'https://google.com',
      },
    ],
  })
}

export const highlighted_rows = new Action(async () => {
  const data = generateRows(50)

  await io.select.table('Select users', {
    data,
    defaultPageSize: 50,
    columns: [
      {
        label: 'User',
        renderCell: row => ({
          label: row.name,
          image: {
            alt: 'Alt tag',
            url: row.image,
            size: 'small',
          },
          highlightColor: 'red',
        }),
      },
      {
        label: 'Email',
        renderCell: row => ({
          url: `mailto:${row.email}`,
          label: row.email,
          highlightColor: 'orange',
        }),
      },
      {
        label: 'Description',
        accessorKey: 'description',
        renderCell: row => ({
          label: row.description,
          highlightColor: 'yellow',
        }),
      },
      {
        label: 'Date',
        accessorKey: 'date',
        renderCell: row => ({
          label: row.date,
          highlightColor: 'green',
        }),
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
      {
        label: 'External',
        url: 'https://google.com',
      },
    ],
  })
})

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

export const big_payload_table = new Page({
  name: 'Big table',
  handler: async () => {
    const bigData = generateRows(10_000)

    return new Layout({
      children: [
        io.display.table('Large table', {
          data: bigData,
          // These don't work, they're just here to make the payload bigger
          rowMenuItems: row => [
            {
              label: 'Browse app structure',
              action: 'organizations/app_structure',
              params: { org: row.email },
            },
            {
              label: 'Change slug',
              action: 'organizations/change_slug',
              params: { org: row.email },
            },
            {
              label: 'Enable SSO',
              action: 'organizations/create_org_sso',
              params: { org: row.email },
            },
            {
              label: 'Toggle feature flag',
              action: 'organizations/org_feature_flag',
              params: { org: row.email },
            },
            {
              label: 'Transfer owner',
              action: 'organizations/transfer_ownership',
              params: { org: row.email },
            },
          ],
        }),
      ],
    })
  },
})

export const async_table_page = new Page({
  name: 'Async table - in a page',
  handler: async () => {
    return new Layout({
      children: [asyncTable(500)],
    })
  },
})

export const async_table: IntervalActionHandler = async () => {
  await asyncTable(500)
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
    const row: (typeof rows)[0] = {}
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
      const [width, height, crazyW, crazyH, tinyW, tinyH] = [
        faker.datatype.number({ min: 500, max: 700 }),
        faker.datatype.number({ min: 200, max: 400 }),
        faker.datatype.number({ min: 100, max: 999 }),
        faker.datatype.number({ min: 100, max: 999 }),
        faker.datatype.number({ min: 12, max: 20 }),
        faker.datatype.number({ min: 12, max: 20 }),
      ]

      return {
        id: i,
        name: faker.name.findName(),
        square: faker.image.avatar(),
        width,
        height,
        crazyW,
        crazyH,
        tinyW,
        tinyH,
        wide: faker.image.imageUrl(width, height, undefined, true),
        tall: faker.image.imageUrl(height, width, undefined, true),
        crazy: faker.image.imageUrl(crazyW, crazyH, undefined, true),
        tiny: faker.image.imageUrl(tinyW, tinyH, undefined, true),
      }
    })

  await io.display.table('Images', {
    data,
    defaultPageSize: 10,
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
      {
        label: 'Tiny',
        renderCell: row => ({
          label: `${row.tinyW} x ${row.tinyH}`,
          image: {
            alt: 'Alt tag',
            url: row.tiny,
          },
        }),
      },
    ],
  })

  await io.display.table('Image sizes', {
    data,
    defaultPageSize: 10,
    columns: [
      'id',
      {
        label: 'None',
        renderCell: row => ({
          image: {
            alt: 'Alt tag',
            url: row.wide,
          },
        }),
      },
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

export const big_table = new Page({
  name: 'Big table',
  handler: async () => {
    const bigData = [
      ...fakeUsers,
      ...fakeUsers,
      ...fakeUsers,
      ...fakeUsers,
      ...fakeUsers,
      ...fakeUsers,
      ...fakeUsers,
      ...fakeUsers,
      ...fakeUsers,
      ...fakeUsers,
    ]

    return new Layout({
      children: [
        io.display.table('Large table', {
          data: bigData,
          // These don't work, they're just here to make the payload bigger
          rowMenuItems: row => [
            {
              label: 'Browse app structure',
              action: 'organizations/app_structure',
              params: { org: row.email },
            },
            {
              label: 'Change slug',
              action: 'organizations/change_slug',
              params: { org: row.email },
            },
            {
              label: 'Enable SSO',
              action: 'organizations/create_org_sso',
              params: { org: row.email },
            },
            {
              label: 'Toggle feature flag',
              action: 'organizations/org_feature_flag',
              params: { org: row.email },
            },
            {
              label: 'Transfer owner',
              action: 'organizations/transfer_ownership',
              params: { org: row.email },
            },
          ],
        }),
      ],
    })
  },
})

export const markdown = new Page({
  name: 'Markdown',
  handler: async () => {
    return new Layout({
      children: [
        io.display.table('', {
          data: [
            {
              index: 0,
              label: 'Bulleted list',
              value: dedent`Here are three bullet points:
                - ${faker.random.word()}
                - ${faker.random.word()}
                - ${faker.lorem.paragraph()}
              
              And a [link](https://www.google.com/) at the end.
              `,
            },
            {
              index: 1,
              label: 'Numbered list',
              value: dedent`1. ${faker.random.word()}
                1. ${faker.random.word()}
                1. ${faker.lorem.paragraph()}
              `,
            },
            {
              index: 2,
              label: 'Code block',
              value: dedent`~~~ts
                const foo: string = 'bar'
                if (foo === 'bar') {
                  console.log('foo is bar')
                } else {
                  console.log('foo is not bar')
                }
                ~~~`,
            },
            {
              index: 3,
              label: 'Code block with some text around it',
              value: dedent`
                Here is some very good code:
                ~~~ts
                const foo: string = 'bar'
                if (foo === 'bar') {
                  console.log('foo is bar')
                } else {
                  console.log('foo is not bar')
                }
                ~~~
                
                Copy and paste that into your editor and you'll be good to go!`,
            },
            {
              index: 4,
              label: 'Inline code',
              value: dedent`This is an example of \`inline code\`.`,
            },
            {
              index: 5,
              label: 'Some headings',
              value: dedent`# Heading 1
              ${faker.lorem.paragraph()}
              ## Heading 2
              ${faker.lorem.paragraph()}
              ### Heading 3
              ${faker.lorem.paragraph()}
              #### Heading 4
              ${faker.lorem.paragraph()}
              ##### Heading 5
              ${faker.lorem.paragraph()}
              ###### Heading 6
              ${faker.lorem.paragraph()}`,
            },
            {
              index: 6,
              label: 'Other elements',
              value: dedent`This is a [link](https://www.google.com/)

              This is a **bold** word, and then a quote:

              > ${faker.lorem.paragraph()}

              This is a horizontal rule:

              ---
              
              ${faker.lorem.paragraph()}
              `,
            },
            {
              index: 7,
              label: 'Paragraphs',
              value: faker.lorem.paragraphs(3),
            },
          ],
          columns: [
            'label',
            {
              label: 'Value',
              renderCell: row => ({
                label: row.value,
                highlightColor: [
                  'red',
                  'orange',
                  'yellow',
                  'green',
                  'blue',
                  'purple',
                  'pink',
                  'gray',
                ][row.index] as HighlightColor,
              }),
            },
          ],
        }),
      ],
    })
  },
})
