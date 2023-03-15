import { Action } from '@interval/sdk/src/experimental'
import { IntervalActionHandler, io } from '../..'
import { faker } from '@faker-js/faker'
import { sleep } from '../utils/helpers'

export const dogs = new Action({
  name: 'Dogs',
  handler: async () => {
    const data = Array(50)
      .fill(null)
      .map((_, i) => ({
        id: i,
        name: faker.name.middleName(),
        description: faker.animal.dog(),
        image: faker.image.imageUrl(
          480,
          Math.random() < 0.25 ? 300 : 480,
          'dog',
          true
        ),
      }))

    await io.display.grid('These dogs are good', {
      data,
      idealColumnWidth: 200,
      renderItem: row => ({
        label: row.name,
        description: row.description,
        route: 'tables/display_table',
        image: {
          url: row.image,
          aspectRatio: 1,
        },
        menu: [
          {
            label: 'View',
            route: 'tables/display_table',
          },
        ],
      }),
    })
  },
})

export const tiktoks = new Action({
  name: 'Top TikToks today',
  handler: async io => {
    const data = Array(50)
      .fill(null)
      .map((_, i) => ({
        id: i,
        label: `video from ${faker.internet.userName()}`,
        description: faker.date.past().toLocaleString(),
        image: faker.image.animals(1080 / 4, 1920 / 4, true),
      }))

    await io.display.grid('', {
      data,
      idealColumnWidth: 220,
      renderItem: row => ({
        label: row.label,
        description: row.description,
        image: {
          url: row.image,
          aspectRatio: 9 / 16,
        },
        url: 'https://tiktok.com',
        menu: [
          {
            label: 'Flag',
            route: 'tables/display_table',
            theme: 'danger',
          },
          {
            label: 'External link',
            url: 'https://tiktok.com',
          },
        ],
      }),
    })
  },
})

export const no_images: IntervalActionHandler = async io => {
  const data = Array(50)
    .fill(null)
    .map((_, i) => ({
      id: i,
      label: faker.commerce.productName(),
      description: faker.commerce.price(100, 200, 0, '$'),
    }))

  await io.display.grid('', {
    data,
    idealColumnWidth: 300,
    renderItem: row => row,
  })
  await io.display.grid('', {
    data,
    idealColumnWidth: 300,
    renderItem: row => ({
      ...row,
      url: 'https://interval.com',
      menu: [
        {
          label: 'View',
          route: 'tables/display_table',
        },
      ],
    }),
  })
}

export const only_images: IntervalActionHandler = async io => {
  const data = Array(50)
    .fill(null)
    .map((_, i) => ({
      id: i,
      name: faker.name.middleName(),
      description: faker.animal.dog(),
      image: faker.image.imageUrl(
        480,
        Math.random() < 0.25 ? 300 : 480,
        'dog',
        true
      ),
    }))

  await io.display.grid('', {
    data,
    idealColumnWidth: 300,
    renderItem: row => ({
      action: 'grids/no_images',
      image: {
        url: row.image,
        aspectRatio: 4 / 3,
      },
    }),
    isFilterable: false,
  })
}

export const music = new Action({
  name: 'Spotify library',
  handler: async io => {
    const data = Array(50)
      .fill(null)
      .map((_, i) => ({
        id: i,
        name: faker.music.songName(),
        artists: faker.name.fullName(),
        image: faker.image.imageUrl(480, 480, 'abstract', true),
      }))

    await io.display.grid('', {
      data,
      idealColumnWidth: 240,
      renderItem: row => ({
        label: row.name,
        description: row.artists,
        image: {
          url: row.image,
          aspectRatio: 1,
        },
        url: 'https://open.spotify.com',
        menu: [
          {
            label: 'Play on Spotify',
            url: 'https://open.spotify.com',
          },
          {
            label: 'Edit',
            route: 'tables/display_table',
            params: { id: row.id ?? '' },
          },
          {
            label: 'Delete',
            route: 'tables/display_table',
            params: { id: row.id ?? '' },
            theme: 'danger',
          },
        ],
      }),
    })
  },
})

export const long_descriptions = new Action({
  name: 'Long descriptions',
  handler: async () => {
    const data = Array(50)
      .fill(null)
      .map((_, i) => ({
        id: i,
        name: faker.name.middleName(),
        description: faker.lorem.paragraph(),
        image: faker.image.imageUrl(
          480,
          Math.random() < 0.25 ? 300 : 480,
          'dog',
          true
        ),
      }))

    await io.display.grid('', {
      data,
      idealColumnWidth: 300,
      renderItem: row => ({
        label: row.name,
        description: row.description,
        image: {
          url: row.image,
          aspectRatio: 4 / 3,
        },
      }),
    })
  },
})

export const empty_state = new Action({
  name: 'Empty state',
  handler: async () => {
    const data = Array(50)
      .fill(null)
      .map((_, i) => ({
        id: i,
        name: faker.name.middleName(),
      }))

    await io.display.grid('', {
      data: data.slice(0, 0),
      idealColumnWidth: 300,
      renderItem: row => ({
        label: row.name,
      }),
    })
  },
})

export const async_grid: IntervalActionHandler = async io => {
  const allData = Array(500)
    .fill(null)
    .map((_, i) => ({
      id: i,
      name: faker.name.middleName(),
      email: faker.internet.email(),
      description: faker.lorem.sentence(),
      image: i % 5 === 0 ? null : faker.image.imageUrl(600, 300, 'dog', true),
    }))

  await io.display.grid<(typeof allData)[0]>('Display users', {
    renderItem: row => ({
      label: row.name,
      description: row.description,
      image: {
        url: row.image,
        aspectRatio: 2,
      },
    }),
    defaultPageSize: 30,
    async getData({ queryTerm, offset, pageSize }) {
      let filteredData = allData.slice()

      if (queryTerm) {
        const re = new RegExp(queryTerm, 'i')

        filteredData = filteredData.filter(row => {
          return (
            re.test(row.name) || re.test(row.email) || re.test(row.description)
          )
        })
      }

      await sleep(500)

      return {
        data: filteredData.slice(offset, offset + pageSize),
        totalRecords: filteredData.length,
      }
    },
  })
}
