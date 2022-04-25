import { IntervalActionHandler } from '../..'

const charges = [
  {
    id: 'b717a9cf-4a3e-41ab-bcda-e2f3ff35c974',
    name: 'Alex',
    amount: 15000,
    purchasedAt: new Date(2022, 0, 15),
  },
  {
    id: 'acc14b04-60d8-4f9d-9907-10ea1ed05fe2',
    name: 'Dan',
    amount: 0,
    promoCode: 'APPLE',
    purchasedAt: new Date(2015, 3, 22),
  },
  {
    id: '91032195-6836-4573-9cd5-0b06ea2379ec',
    name: 'Jacob',
    amount: 1200,
    promoCode: 'BANANA',
    arr: [1, 2, 3],
    purchasedAt: new Date(2018, 10, 7),
  },
  {
    id: '48d10a1a-9c8c-4426-8d0c-796610c652f3',
    name: 'Ryan',
    amount: 2022,
    promoCode: 'ORANGE',
    nested: {
      a: 'b',
    },
    purchasedAt: new Date(2000, 12, 15),
  },
]

function formatCurrency(amount: number) {
  return amount.toLocaleString('en-US', { currency: 'usd', style: 'currency' })
}

export const table_basic: IntervalActionHandler = async io => {
  const selections = await io.select.table('Select from this table', {
    data: [...charges, ...charges, ...charges, ...charges],
    minSelections: 1,
    maxSelections: 3,
  })
  await io.display.object('Selected', { data: selections })
}

export const table_custom_columns: IntervalActionHandler = async io => {
  type Charge = typeof charges[0]
  const selections = await io.select.table('Select from this table', {
    data: [
      ...charges,
      ...charges,
      ...charges,
      ...charges,
      ...charges,
      ...charges,
    ],
    columns: [
      {
        label: 'ID',
        renderCell: row => ({
          label: row.id.slice(0, 5),
          href: `https://dashboard.stripe.com/${row.id}`,
        }),
      },
      {
        label: 'Name',
        renderCell: row => row.name,
      },
      {
        label: 'Number',
        renderCell: row => row.amount,
      },
      {
        label: 'Price',
        renderCell: row => ({
          label: formatCurrency(row.amount ? row.amount / 100 : 0),
          value: row.amount,
        }),
      },
      {
        label: 'Promo code',
        renderCell: (row: Charge) => ({
          label: row.promoCode,
        }),
      },
      {
        label: 'Purchased at',
        renderCell: (row: Charge) => ({
          label: row.purchasedAt.toLocaleString(),
          value: row.purchasedAt,
        }),
      },
    ],
    minSelections: 1,
    maxSelections: 2,
  })

  await io.display.object('Selected', { data: selections })
}
