import { T_IO_METHOD } from '../ioSchema'
import fakeUsers from './fakeUsers'

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function mapToSelectOption(inputUser: {
  username: string
  first_name: string
  last_name: string
  email: string
}): T_IO_METHOD<'SELECT_SINGLE', 'props'>['options'][0] {
  const name = `${inputUser.first_name} ${inputUser.last_name}`
  return {
    value: inputUser.username,
    label: name,
    description: inputUser.email,
    imageUrl: `https://avatars.dicebear.com/api/pixel-art/${encodeURIComponent(
      name
    )}.svg?scale=96&translateY=10`,
  }
}

export const fakeDb = (function fakeDb() {
  const data = fakeUsers

  return {
    async find(input: string) {
      await sleep(500)
      const inputLower = input.toLowerCase()
      return data
        .filter(v => {
          const searchStr = (v.email + v.first_name + v.last_name).toLowerCase()
          return searchStr.includes(inputLower)
        })
        .slice(0, 10)
        .map(mapToSelectOption)
    },
  }
})()
