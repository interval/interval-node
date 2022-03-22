import { IntervalActionHandler } from '..'

const charges = [
  {
    id: 'b717a9cf-4a3e-41ab-bcda-e2f3ff35c974',
    name: 'Alex',
    amount: 1500,
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
  },
  {
    id: '48d10a1a-9c8c-4426-8d0c-796610c652f3',
    name: 'Ryan',
    amount: 2022,
    promoCode: 'ORANGE',
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
        key: 'id',
        formatter: value => value.slice(0, 5),
        href: 'https://interval.com',
      },
      { key: 'name', label: 'Name' },
      {
        key: 'amount',
        label: 'Price',
        formatter: value => formatCurrency(value ? value / 100 : 0),
      },
      {
        key: 'promoCode',
        label: 'Promo code',
        formatter: value => value ?? '(None)',
      },
    ],
  })

  await io.display.object('Selected', { data: selections })
}
