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
  },
  {
    id: '91032195-6836-4573-9cd5-0b06ea2379ec',
    name: 'Jacob',
    amount: 1200,
  },
  {
    id: '48d10a1a-9c8c-4426-8d0c-796610c652f3',
    name: 'Ryan',
    amount: 2022,
  },
]

function formatCurrency(amount: number) {
  return amount.toLocaleString('en-US', { currency: 'usd', style: 'currency' })
}

export const table_basic: IntervalActionHandler = async io => {
  const selections = await io.select.table('Select from this table', {
    data: charges.map(ch => ({
      id: { label: ch.id.slice(0, 5), value: ch.id },
      name: ch.name,
      amount: { label: formatCurrency(ch.amount), value: ch.amount },
    })),
  })

  await io.display.object('Selected', { data: selections })
}

export const table_custom_columns: IntervalActionHandler = async io => {
  const selections = await io.select.table('Select from this table', {
    columns: ['ID', 'Name', 'Price'],
    data: charges.map(ch => ({
      id: { label: ch.id.slice(0, 5), value: ch.id },
      name: ch.name,
      amount: { label: formatCurrency(ch.amount), value: ch.amount },
    })),
  })

  await io.display.object('Selected', { data: selections })
}
