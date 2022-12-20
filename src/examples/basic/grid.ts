import { Action } from '@interval/sdk/src/experimental'
import { IntervalActionHandler, io } from '../..'
import { faker } from '@faker-js/faker'

function generateRows(count: number, offset = 0) {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      id: offset + i,
      name: faker.name.middleName(),
      description: faker.animal.dog(),
      image: faker.image.imageUrl(
        480,
        Math.random() < 0.25 ? 300 : 480,
        'dog',
        true
      ),
    }))
}

export const dogs = new Action({
  name: 'Dogs',
  handler: async () => {
    const data = generateRows(50)

    await io.display.grid('These dogs are good', {
      data,
      idealColumnWidth: 200,
      helpText: 'None of these items are linked.',
      renderItem: row => ({
        title: row.name,
        description: row.description,
        image: {
          url: row.image,
          borderRadius: '100%',
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
    const data = generateRows(50)

    await io.display.grid('', {
      data,
      idealColumnWidth: 300,
      renderItem: row => ({
        title: `video from ${faker.internet.userName()}`,
        description: faker.date.past().toLocaleString(),
        image: {
          url: faker.image.animals(1080 / 4, 1920 / 4, true),
          aspectRatio: 9 / 16,
        },
        menu: [
          {
            label: 'Flag',
            route: 'tables/display_table',
            theme: 'danger',
          },
        ],
      }),
    })
  },
})

export const no_images: IntervalActionHandler = async io => {
  const data = generateRows(50)

  await io.display.grid('', {
    data,
    idealColumnWidth: 300,
    renderItem: row => ({
      title: faker.commerce.productName(),
      description: faker.commerce.price(100, 200, 0, '$'),
    }),
  })
}

export const only_images: IntervalActionHandler = async io => {
  const data = generateRows(50)

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
  })
}

export const music = new Action({
  name: 'Spotify library',
  handler: async io => {
    await io.display.grid('', {
      data: JSON.parse(spotifyData),
      idealColumnWidth: 240,
      renderItem: row => ({
        title: row.name,
        description: row.artists,
        image: {
          url: row.imageUrl,
          aspectRatio: 1,
          borderRadius: 4,
          width: 'small',
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
    const data = generateRows(50)

    await io.display.grid('', {
      data,
      idealColumnWidth: 300,
      renderItem: row => ({
        title: row.name,
        description: faker.lorem.paragraph(),
        image: {
          url: row.image,
          aspectRatio: 4 / 3,
        },
      }),
    })
  },
})

const spotifyData = `[{"name":"Roots","artists":"Klur","imageUrl":"https://i.scdn.co/image/ab67616d0000b273f4531cc8cde73c37428c690e"},{"name":"About You","artists":"Nils Hoffmann, Malou","imageUrl":"https://i.scdn.co/image/ab67616d0000b2736b7bd36ac626c18c56e1f289"},{"name":"9 Days","artists":"Nils Hoffmann, Julia Church","imageUrl":"https://i.scdn.co/image/ab67616d0000b2736b7bd36ac626c18c56e1f289"},{"name":"Let Me Go","artists":"Nils Hoffmann, TENDER","imageUrl":"https://i.scdn.co/image/ab67616d0000b2736b7bd36ac626c18c56e1f289"},{"name":"Sirene - Original Mix","artists":"Blinders","imageUrl":"https://i.scdn.co/image/ab67616d0000b27391ffda7f2384bde0ebcede72"},{"name":"GO","artists":"Amersy","imageUrl":"https://i.scdn.co/image/ab67616d0000b2732ba9ee385b12dac5eba1a86f"},{"name":"Life is Beautiful","artists":"Quart","imageUrl":"https://i.scdn.co/image/ab67616d0000b273b8e5adb7f33c8d8c0e1b5989"},{"name":"Echoes","artists":"Martin Roth","imageUrl":"https://i.scdn.co/image/ab67616d0000b2736fd0518da8e652c8a8c9f606"},{"name":"Jungle","artists":"Fred again..","imageUrl":"https://i.scdn.co/image/ab67616d0000b273f53460be9a3f788777b0fe5c"},{"name":"For The People","artists":"Nicky Romero, Third Party","imageUrl":"https://i.scdn.co/image/ab67616d0000b273c642e00eda1d691dbec4109c"},{"name":"My Life (feat. Joe Killington)","artists":"Wh0, Armand Van Helden, Joe Killington","imageUrl":"https://i.scdn.co/image/ab67616d0000b273f5a9cd92c42d19eb286460c9"},{"name":"Jaguar","artists":"What So Not","imageUrl":"https://i.scdn.co/image/ab67616d0000b273856dd77a55471e105c276571"},{"name":"Try It Out - Neon Mix","artists":"Skrillex, Alvin Risk","imageUrl":"https://i.scdn.co/image/ab67616d0000b2730fa3e89ea1b927df91f7f653"},{"name":"Wasted - Extended Mix","artists":"Meikle, Riley James, Robbie Rosen","imageUrl":"https://i.scdn.co/image/ab67616d0000b27335814f5f8cbcb6dc9572801f"},{"name":"I Need To Know - Extended Mix","artists":"Timmo Hendriks, Scott Forshaw, JJ Beck, Sam Welch","imageUrl":"https://i.scdn.co/image/ab67616d0000b273b3c663ab8b0559b5d581d8f9"},{"name":"Dreaming - Extended Mix","artists":"Waxel, Fedo, Max Landry","imageUrl":"https://i.scdn.co/image/ab67616d0000b2731df93a87d270a7bfded17156"},{"name":"Lost & Found","artists":"Justin Prime, Voster & Gallardo, Joe Mann","imageUrl":"https://i.scdn.co/image/ab67616d0000b2738cfcb087aed302d912391e34"},{"name":"Techtronic - Extended Mix","artists":"Nicky Romero","imageUrl":"https://i.scdn.co/image/ab67616d0000b2734c31ccb2f27e564d1c823b1b"},{"name":"Lonely World","artists":"Timmo Hendriks","imageUrl":"https://i.scdn.co/image/ab67616d0000b2737cec8e3e7117ea917f7dcedd"},{"name":"Your Body - KAAZE Mix","artists":"BLK RSE, KAAZE","imageUrl":"https://i.scdn.co/image/ab67616d0000b2735df9ad7114eeaaeef2b94f3f"},{"name":"Better Days","artists":"Drove","imageUrl":"https://i.scdn.co/image/ab67616d0000b273b7573b4fc62e6ef99e7746d3"},{"name":"Take Me High","artists":"Kx5, deadmau5, Kaskade","imageUrl":"https://i.scdn.co/image/ab67616d0000b27327c2836e9efac3d5dec66375"},{"name":"Kite Zo A - Michael Brun Remix (Mixed)","artists":"Lakou Mizik, Joseph Ray, Michael Brun","imageUrl":"https://i.scdn.co/image/ab67616d0000b27376ed91a73bb9c249ec4bc72c"},{"name":"shake our bones","artists":"Jean Tonique, warner case","imageUrl":"https://i.scdn.co/image/ab67616d0000b273f236897a4bf253773d2a9052"},{"name":"Odyssey","artists":"Massano","imageUrl":"https://i.scdn.co/image/ab67616d0000b273189d44ead3ddce518d1630bf"},{"name":"Tecno","artists":"Crossnaders","imageUrl":"https://i.scdn.co/image/ab67616d0000b273c6dde0e420c68277a3a6f2b3"},{"name":"Hallucinate","artists":"Magnificence","imageUrl":"https://i.scdn.co/image/ab67616d0000b2736463e42d31a80d825140d12f"},{"name":"gettin' hott","artists":"Knock2","imageUrl":"https://i.scdn.co/image/ab67616d0000b2732128e0d62ffe3c35f70947ab"},{"name":"Everything Goes On","artists":"Porter Robinson, League of Legends","imageUrl":"https://i.scdn.co/image/ab67616d0000b2732b1a62237771427afb899387"},{"name":"I'll Be There","artists":"Sick Individuals, Dastic","imageUrl":"https://i.scdn.co/image/ab67616d0000b2732647a52b1a7b1d8770129465"},{"name":"Don’t Let Me Let Go (with ILLENIUM & EVAN GIIA)","artists":"Dillon Francis, ILLENIUM, EVAN GIIA","imageUrl":"https://i.scdn.co/image/ab67616d0000b2732dfcdd679c42aa58588e6bda"},{"name":"Let You Go - Sebastian Ingrosso & Desembra Remix","artists":"Diplo, TSHA, Sebastian Ingrosso, Kareen Lomax, Desembra","imageUrl":"https://i.scdn.co/image/ab67616d0000b273cd8fcee128d75bfd1b6d3cd4"},{"name":"MAMI","artists":"Chris Lorenzo, COBRAH","imageUrl":"https://i.scdn.co/image/ab67616d0000b273cf869fb170589a410a5099d1"},{"name":"Close My Eyes","artists":"Matt Fax, Jack Dawson","imageUrl":"https://i.scdn.co/image/ab67616d0000b273a8c3c5297e41a39a36f7a4c8"},{"name":"Loop","artists":"Martin Garrix, DallasK, Sasha Alex Sloan","imageUrl":"https://i.scdn.co/image/ab67616d0000b273bd114f3939212795035b0bd3"},{"name":"Prometheus","artists":"ARTBAT","imageUrl":"https://i.scdn.co/image/ab67616d0000b273aeaf34612ff609979185c25e"},{"name":"Hunting Grounds - Man Power Remix","artists":"La Fleur, Man Power","imageUrl":"https://i.scdn.co/image/ab67616d0000b273056646e37a0c901bbea7ff56"},{"name":"Morena","artists":"Henry Fong","imageUrl":"https://i.scdn.co/image/ab67616d0000b273ad362abe6d8f35fe5d1a4525"},{"name":"Higher - Low Blow Remix","artists":"Juicy M, Vessbroz, Low Blow","imageUrl":"https://i.scdn.co/image/ab67616d0000b2733061fbe0943bc90531f230e7"},{"name":"Must Be The Love - Enamour Remix","artists":"ARTY, Nadia Ali, BT, Enamour","imageUrl":"https://i.scdn.co/image/ab67616d0000b2738a7d589425980a9fb2155cae"},{"name":"The Oracle","artists":"Mâhfoud","imageUrl":"https://i.scdn.co/image/ab67616d0000b273c97ae9a2542a1b15024da9d9"},{"name":"Life Is Strange - Lunar Plane Remix","artists":"Chambord, Lunar Plane","imageUrl":"https://i.scdn.co/image/ab67616d0000b273f80fe655fa83858f8f4ca947"},{"name":"Believe In Me","artists":"Marten Hørger, Donkong","imageUrl":"https://i.scdn.co/image/ab67616d0000b2732ab45067509e4dab4a636232"},{"name":"Drown","artists":"Donkong, ALOTT","imageUrl":"https://i.scdn.co/image/ab67616d0000b273733590e8552f1719449b0760"},{"name":"Under Dark - Innellea Remix","artists":"Monolink, Innellea","imageUrl":"https://i.scdn.co/image/ab67616d0000b273d92a48f3675222e57a477e63"},{"name":"Concrete Jungle - Transhumanism Project (1/3)","artists":"Innellea","imageUrl":"https://i.scdn.co/image/ab67616d0000b273a17ec7ad82bffceed39b7106"},{"name":"Feel My Love (feat. Joe Taylor) - Festival Mix","artists":"Lucas & Steve, DubVision, Joe Taylor","imageUrl":"https://i.scdn.co/image/ab67616d0000b273378a6a5419a5ab9d368ef82b"},{"name":"Be Better","artists":"Raven & Kreyn, Mingue","imageUrl":"https://i.scdn.co/image/ab67616d0000b2734fbc75ee35c0f5113a4f4ef6"},{"name":"Feel The Beat","artists":"Raven & Kreyn, Chester Young","imageUrl":"https://i.scdn.co/image/ab67616d0000b273b4cf844a51a32ee158fd82d1"},{"name":"Damage Each Other","artists":"Steve Brian, Danni Baylor","imageUrl":"https://i.scdn.co/image/ab67616d0000b273f3e1863fba95d75b31ea290d"}]`
