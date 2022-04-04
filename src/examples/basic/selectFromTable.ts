import { IntervalActionHandler } from '../..'

const charges = [
  {
    id: 'b717a9cf-4a3e-41ab-bcda-e2f3ff35c974',
    name: 'Alex',
    amount: 15000,
  },
  {
    id: 'acc14b04-60d8-4f9d-9907-10ea1ed05fe2',
    name: 'Dan',
    amount: 0,
    promoCode: 'APPLE',
  },
  {
    id: '91032195-6836-4573-9cd5-0b06ea2379ec',
    name: 'Jacob',
    amount: 1200,
    promoCode: 'BANANA',
    arr: [1, 2, 3],
  },
  {
    id: '48d10a1a-9c8c-4426-8d0c-796610c652f3',
    name: 'Ryan',
    amount: 2022,
    promoCode: 'ORANGE',
    nested: {
      a: 'b',
    },
  },
]

function formatCurrency(amount: number) {
  return amount.toLocaleString('en-US', { currency: 'usd', style: 'currency' })
}

export const table_basic: IntervalActionHandler = async io => {
  const selections = await io.select.table('Select from this table', {
    data: charges,
  })
  await io.display.object('Selected', { data: selections })
}

export const table_custom_columns: IntervalActionHandler = async io => {
  const selections = await io.select.table('Select from this table', {
    data: charges,
    columns: [
      {
        label: 'ID',
        render: row => ({
          label: row.id.slice(0, 5),
          href: `https://dashboard.stripe.com/${row.id}`,
        }),
      },
      {
        label: 'Name',
        render: row => row.name,
      },
      {
        label: 'Number',
        render: row => row.number,
      },
      {
        label: 'Price',
        render: row => ({
          label: formatCurrency(row.amount ? row.amount / 100 : 0),
          value: row.amount,
        }),
      },
      {
        label: 'Promo Code',
        render: row => row.promoCode ?? 'None',
      },
    ],
  })

  await io.display.object('Selected', { data: selections })
}
