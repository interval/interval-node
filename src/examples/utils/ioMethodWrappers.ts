import { io } from '../..'
import { generateRows } from './helpers'

export function asyncTable(numRows: number) {
  const allData = generateRows(numRows)
  return io.display.table<ReturnType<typeof generateRows>[0]>('Display users', {
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
        renderCell: row => {
          return {
            label: row.name,
            image: {
              alt: 'Alt tag',
              url: row.image,
              size: 'small',
            },
          }
        },
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
