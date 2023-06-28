import Interval, { IOError, io, ctx, Action, Page, Layout } from '../../index'
import IntervalClient from '../../classes/IntervalClient'
import {
  IntervalActionDefinition,
  IntervalActionHandler,
  NotificationDeliveryInstruction,
} from '../../types'
import editEmailForUser from './editEmail'
import {
  fakeDb,
  mapToIntervalUser,
  sleep,
  generateRows,
} from '../utils/helpers'
import type { EventualMetaItem } from '../../components/displayMetadata'
import * as table_actions from './table'
import * as grid_actions from './grid'
import unauthorized from './unauthorized'
import './ghostHost'
import { generateS3Urls } from '../utils/upload'
import fs from 'fs'
import fakeUsers from '../utils/fakeUsers'
import dedent from 'dedent'

const gridsPage = new Page({
  name: 'Grids',
  routes: grid_actions,
  // including this to test two-column page layouts
  handler: async () => {
    const sortAZ = ctx.params.sortAZ

    const data = Object.keys(grid_actions).map(k => ({
      name: k,
    }))

    if (ctx.params.sortAZ) {
      data.sort((a, b) => a.name.localeCompare(b.name))
    }

    return new Layout({
      title: 'Grids',
      menuItems: [
        sortAZ
          ? {
              label: 'Reset sort',
              route: 'grids',
            }
          : {
              label: 'Sort A-Z',
              route: 'grids',
              params: { sortAZ: true },
            },
      ],
      children: [
        io.display.table(`Grid layouts (${sortAZ ? 'sorted' : 'not sorted'})`, {
          data,
          columns: [
            {
              label: 'Name',
              renderCell: ({ name }) => ({
                label: name,
                route: `grids/${name}`,
              }),
            },
          ],
        }),
      ],
    })
  },
})

const page1 = new Page({
  name: 'Page with children',
  handler: async () => new Layout({}),
  routes: {
    child_action1: new Action(async () => 'Hello, world!'),
    child_action2: new Action(async () => 'Hello, world!'),
    child_page: new Page({
      name: 'Child page',
    }),
  },
})

const page2 = new Page({
  name: 'Page with page with children',
  routes: {
    page1,
  },
})

const sidebar_depth = new Page({
  name: 'Sidebar depth page testing',
  routes: {
    page1,
    page2,
  },
})

const empty_page = new Page({
  name: 'Empty page',
  handler: async () => {
    if (ctx.params.show_layout) {
      return new Layout({
        title: 'Contents!',
        children: [io.display.markdown('Children!')],
        menuItems: [
          {
            label: 'Hide layout',
            route: 'empty_page',
          },
        ],
      })
    }
  },
  routes: {
    child_action: new Action(async () => {
      await io.group([
        io.display.link('Go to unlisted action', {
          route: 'empty_page/unlisted_action',
          theme: 'secondary',
        }),
        io.display.link('Go to unlisted page', {
          route: 'empty_page/unlisted_page',
          theme: 'secondary',
        }),
      ])
    }),
    unlisted_action: new Action({
      unlisted: true,
      handler: async () => {
        return 'Hello!'
      },
    }),
    unlisted_page: new Page({
      name: 'Unlisted page',
      unlisted: true,
      handler: async () => {
        return new Layout({
          children: [
            io.display.markdown(
              'This page is unlisted, but you can still access it!'
            ),
          ],
        })
      },
    }),
    show_layout: new Action(async () => {
      ctx.redirect({ route: 'empty_page', params: { show_layout: 1 } })
    }),
  },
})

const confirmIdentity = new Action({
  name: 'Confirm identity',
  handler: async () => {
    await io.input.text('Enter your name')

    const canDoSensitiveTask = await io.confirmIdentity(
      'This action is pretty sensitive',
      {
        gracePeriodMs: 0,
      }
    )
    let canDoSensitiveTaskAgain = false

    if (canDoSensitiveTask) {
      ctx.log('OK! Identity confirmed.')
      await io.input.text('Enter another name')
      canDoSensitiveTaskAgain = await io.confirmIdentity(
        'This action is still pretty sensitive'
      )
    } else {
      ctx.log('Identity not confirmed, cancelling…')
    }

    return {
      identityConfirmed: canDoSensitiveTask && canDoSensitiveTaskAgain,
    }
  },
})

const actionLinks: IntervalActionHandler = async () => {
  await io.group([
    io.display.table('In a table!', {
      data: [
        { slug: undefined },
        { slug: 'noInteractiveElements' },
        {
          slug: 'helloCurrentUser',
          params: { message: 'Hi from a table!' },
        },
      ],
      columns: [
        {
          label: 'Action slug',
          renderCell: row => row.slug,
        },
        {
          label: 'Link',
          renderCell: row => ({
            label: row.slug ?? '(undefined)',
            action: row.slug,
            params: row.params,
          }),
        },
      ],
    }),
    io.display.link('External link', {
      url: 'https://example.com',
    }),
    io.display.link('Action link', {
      route: 'helloCurrentUser',
      params: {
        message: 'From a button!',
      },
    }),
    io.display.link('This same action', {
      route: 'actionLinks',
      params: {
        prevActionAt: new Date().toISOString(),
      },
    }),
  ])
}

const echoContext = new Action(async () => {
  await io.display.object('Context', {
    data: {
      organization: ctx.organization,
      aciton: ctx.action,
      environment: ctx.environment,
      params: ctx.params,
      user: ctx.user,
    },
  })
})

const redirect_page_test = new Page({
  name: 'Redirector',
  handler: async () => {
    await ctx.redirect({
      route: 'echoContext',
      params: { from: 'redirect_page_test' },
      replace: true,
    })

    // Not necessary after #1206 is merged
    return new Layout({})
  },
})

const prod = new Interval({
  apiKey: 'live_N47qd1BrOMApNPmVd0BiDZQRLkocfdJKzvt8W6JT5ICemrAN',
  endpoint: 'ws://localhost:3000/websocket',
  logLevel: 'debug',
  routes: {
    sidebar_depth,
    redirect_page_test,
    backgroundable: {
      backgroundable: true,
      handler: async () => {
        const first = await io.input.text('First input')
        await ctx.loading.start({
          label: 'Thinking...',
          description: 'This will take 5 seconds, feel free to navigate away.',
        })
        await sleep(5_000)
        const second = await io.input.text('Second input')

        return { first, second }
      },
    },
    ping: new Action({
      name: 'Ping',
      handler: async () => {
        await prod.ping()
        return 'Pong!'
      },
    }),
    actionLinks,
    echoContext,
    confirm_identity: confirmIdentity,
    continueCmdEnter: {
      name: 'CMD + Enter submit demo',
      handler: async () => {
        const [theme, label, requireCompletion] = await io.group([
          io.select.single('Theme', {
            options: ['primary', 'danger', 'secondary'],
            defaultValue: 'primary',
          }),
          io.input.text('Label', {
            defaultValue: 'Continue',
          }),
          io.input.boolean('Require completion?', {
            defaultValue: false,
          }),
        ])

        const [value] = await io.group(
          [
            io.input.text('Enter some multiline text', {
              multiline: true,
              defaultValue: 'Say something...',
            }),
            io.input.number('Enter a number').optional(!requireCompletion),
          ],
          {
            continueButton: {
              theme: theme as 'primary' | 'secondary' | 'danger',
              label,
            },
          }
        )

        return `You said: ${value}`
      },
    },
    helloCurrentUser: {
      name: 'Hello, current user!',
      description: '👋',
      handler: async () => {
        console.log(ctx.params)

        let heading = `Hello, ${ctx.user.firstName} ${ctx.user.lastName}`

        if (ctx.params.message) {
          heading += ` (Message: ${ctx.params.message})`
        }

        return heading
      },
    },
    redirectWithoutWarningTest: {
      warnOnClose: false,
      handler: async () => {
        const text = await io.input.text('Edit text before navigating', {
          defaultValue: 'Backspace me',
        })
        const text2 = await io.input.text('Edit text before navigating', {
          defaultValue: 'Backspace me',
        })
        ctx.redirect({ action: 'actionLinks' })
      },
    },
    ImportUsers: {
      backgroundable: true,
      name: 'Import users',
      description: "Doesn't actually import users",
      access: {
        teams: ['support'],
      },
      handler: async io => {
        console.log("I'm a live mode action")
        const name = await io.input.text('Enter the name for a user')
        return { name }
      },
    } as IntervalActionDefinition,
    enter_two_numbers: new Action({
      handler: async io => {
        const num1 = await io.input.number('Enter a number')

        try {
          const num2 = await io.input.number(
            `Enter a second number that's greater than ${num1}`,
            {
              min: num1 + 0.01,
              decimals: 2,
            }
          )

          return { num1, num2 }
        } catch (err) {
          if (err instanceof IOError) {
            // Do some long cleanup work
            await sleep(num1 * 1000)

            return {
              'Cleanup time': `${num1} seconds`,
              'Cleanup completed': new Date(),
            }
          }

          // Other error in host code
          throw new Error('Something bad happened!')
        }
      },
    }),
    enter_two_numbers_no_prompt: new Action({
      warnOnClose: false,
      handler: async io => {
        const num1 = await io.input.number('Enter a number')
        const num2 = await io.input.number(
          `Enter a second number that's greater than ${num1}`,
          {
            min: num1 + 0.01,
            decimals: 2,
          }
        )

        return { num1, num2 }
      },
    }),
    enter_one_number: async (io, ctx) => {
      ctx.log('Requesting a number')
      const num = await io.input.number('Enter a number')
      ctx.log('Received', num)
      ctx.log('Received 1', num)
      ctx.log('Received 2', num)
      ctx.log('Received 3', num)

      return { num }
    },
    perform_redirect_flow: async () => {
      let startedWork = false
      const { workDone = false } = ctx.params
      if (!workDone) {
        await ctx.redirect({
          route: 'perform_common_work',
        })
        startedWork = true
      }

      console.log({ startedWork, workDone })

      return {
        startedWork,
        workDone,
      }
    },
    perform_common_work: async () => {
      ctx.loading.start(
        'Performing some work, will redirect back when complete'
      )
      await sleep(2000)
      await ctx.redirect({
        route: 'perform_redirect_flow',
        params: {
          workDone: true,
        },
      })
    },
    empty_page,
    grids: gridsPage,
    tables: new Page({
      name: 'Tables',
      routes: table_actions,
    }),
    async_page_test: new Page({
      name: 'Async page test',
      handler: async () => {
        await sleep(2_000)

        await ctx.loading.start('Generating page...')

        await sleep(2_000)

        await ctx.loading.start({
          label: 'Generating rows...',
          itemsInQueue: 100,
        })

        for (let i = 0; i < 100; i++) {
          await ctx.loading.completeOne()
          await sleep(100)
        }

        const allData = generateRows(100)

        return new Layout({
          children: [
            io.display.table<ReturnType<typeof generateRows>[0]>(
              'Display users',
              {
                async getData({
                  queryTerm,
                  sortColumn,
                  sortDirection,
                  offset,
                  pageSize,
                }) {
                  let filteredData = allData.slice()

                  if (queryTerm) {
                    const re = new RegExp(queryTerm, 'i')

                    filteredData = filteredData.filter(row => {
                      return (
                        re.test(row.name) ||
                        re.test(row.email) ||
                        re.test(row.description)
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
                columns: ['id', 'email', 'description'],
                rowMenuItems: row => [
                  {
                    label: 'Edit',
                    route: 'edit_user',
                    params: { email: row.email },
                  },
                ],
              }
            ),
          ],
        })
      },
    }),
  },
})

prod.listen()

const interval = new Interval({
  apiKey: 'alex_dev_kcLjzxNFxmGLf0aKtLVhuckt6sziQJtxFOdtM19tBrMUp5mj',
  logLevel: 'debug',
  endpoint: 'ws://localhost:3000/websocket',
  onError: props => {
    console.debug('onError', props)
  },
  routes: {
    sidebar_depth,
    echoContext,
    redirect_page_test,
    empty_page,
    ping: new Action({
      name: 'Ping',
      handler: async () => {
        await prod.ping()
        return 'Pong!'
      },
    }),
    inputRightAfterDisplay: async () => {
      await io.display.link('Display', {
        url: '',
      })
      await io.input.text('Text')
    },
    loadingAfterDisplay: new Action({
      name: 'Broken loading',
      handler: async () => {
        await io.display.heading('Hello from display')
        await ctx.loading.start({
          label: 'Waiting for external system',
        })

        await sleep(2000)

        await io.display.markdown('Done!')
      },
    }),
    searches: new Page({
      name: 'Search',
      routes: {
        two_searches: async io => {
          const [r1, r2] = await io.group([
            io.search('One', {
              onSearch: async query => fakeDb.find(query),
              renderResult: result => ({
                label: `${result.first_name} ${result.last_name}`,
              }),
            }),
            io.search('Two', {
              onSearch: async query => fakeDb.find(query),
              renderResult: result => ({
                label: `${result.first_name} ${result.last_name}`,
              }),
            }),
          ])

          console.log({ r1, r2 })
        },
        multiple_search: async io => {
          const bareResults = await io
            .search('Bare', {
              onSearch: async query => fakeDb.find(query),
              renderResult: result => ({
                label: `${result.first_name} ${result.last_name}`,
              }),
            })
            .multiple()

          const [groupResults] = await io.group([
            io
              .search('In a group', {
                onSearch: async query => fakeDb.find(query),
                renderResult: result => ({
                  label: `${result.first_name} ${result.last_name}`,
                }),
              })
              .multiple(),
          ])

          console.log({ bareResults, groupResults })

          return {
            'Bare selected': bareResults
              .map(r => `${r.first_name} ${r.last_name}`)
              .join(', '),
            'Group selected': groupResults
              .map(r => `${r.first_name} ${r.last_name}`)
              .join(', '),
          }
        },
        optional_multiple: async io => {
          const bareResults = await io
            .search('Bare', {
              onSearch: async query => fakeDb.find(query),
              renderResult: result => ({
                label: `${result.first_name} ${result.last_name}`,
              }),
            })
            .multiple()
            .optional()

          const [groupResults] = await io.group([
            io
              .search('In a group', {
                onSearch: async query => fakeDb.find(query),
                renderResult: result => ({
                  label: `${result.first_name} ${result.last_name}`,
                }),
              })
              .multiple()
              .optional(),
          ])

          console.log({ bareResults, groupResults })

          return {
            'Bare selected':
              bareResults
                ?.map(r => `${r.first_name} ${r.last_name}`)
                ?.join(', ') ?? 'None!',
            'Group selected':
              groupResults
                ?.map(r => `${r.first_name} ${r.last_name}`)
                ?.join(', ') ?? 'None!',
          }
        },
        multiple_validation: async io => {
          const bareResults = await io
            .search('Bare', {
              onSearch: async query => fakeDb.find(query),
              renderResult: result => ({
                label: `${result.first_name} ${result.last_name}`,
              }),
            })
            .validate(() => {
              throw new Error('This should never be called!')
            })
            .multiple()
            .validate(results => {
              console.log('Bare', results)
              return undefined
            })

          const [groupResults] = await io
            .group([
              io
                .search('In a group', {
                  onSearch: async query => fakeDb.find(query),
                  renderResult: result => ({
                    label: `${result.first_name} ${result.last_name}`,
                  }),
                })
                .validate(() => {
                  throw new Error('This should never be called!')
                })
                .multiple()
                .optional()
                .validate(results => {
                  console.log('Group inner', results)
                  return undefined
                }),
            ])
            .validate(([results]) => {
              console.log('Group outer', results)
              return undefined
            })

          console.log({ bareResults, groupResults })

          return {
            'Bare selected': bareResults
              .map(r => `${r.first_name} ${r.last_name}`)
              .join(', '),
            'Group selected':
              groupResults
                ?.map(r => `${r.first_name} ${r.last_name}`)
                ?.join(', ') ?? 'None!',
          }
        },
        default_value: async io => {
          const bareResult = await io.search('Bare', {
            onSearch: async query => fakeDb.find(query),
            renderResult: result => ({
              label: `${result.first_name} ${result.last_name}`,
            }),
            defaultValue: fakeUsers[0],
          })

          const [groupResults] = await io.group([
            io
              .search('In a group', {
                onSearch: async query => fakeDb.find(query),
                renderResult: result => ({
                  label: `${result.first_name} ${result.last_name}`,
                }),
              })
              .multiple({
                defaultValue: await fakeDb.find('jo'),
              }),
          ])

          console.log({ bareResult, groupResults })

          return {
            'Bare selected': `${bareResult.first_name} ${bareResult.last_name}`,
            'Group selected': groupResults
              .map(r => `${r.first_name} ${r.last_name}`)
              .join(', '),
          }
        },
      },
    }),
    section_heading: async io => {
      await io.group([
        io.display.heading('Section heading', {
          level: 2,
          description: 'A section heading here',
          menuItems: [
            { label: 'Link', url: 'https://interval.com', theme: 'primary' },
            { label: 'Danger', action: 'disabled_inputs', theme: 'danger' },
          ],
        }),
        io.input.text('Text input'),
        io.input.text('Multiline', {
          multiline: true,
        }),

        io.display.heading('Sub-heading', {
          level: 3,
          description: 'A subsection',
        }),
      ])
    },
    spreadsheet: async io => {
      const sheet = await io.experimental.spreadsheet('Enter records', {
        columns: {
          string: 'string',
          optionalString: 'string?',
          number: 'number',
          boolean: 'boolean',
        },
      })

      return sheet[0]
    },
    optional: async io => {
      await io.input.text('Text').optional()
      await io.input.email('Email').optional()
      await io.input.number('Number').optional()
      await io.input.richText('Rich text').optional()
      await io.input.date('Date').optional()
      await io.input.time('Time').optional()
      await io.input.datetime('Datetime').optional()

      await io.select
        .single('Select single', {
          options: [],
        })
        .optional()
      await io.select
        .single('Select multiple', {
          options: [],
        })
        .optional()
      await io
        .search('Search', {
          async onSearch() {
            return []
          },
          renderResult: () => '',
        })
        .optional()

      const date = await io.input.date('Date').optional()
      const datetime = await io.input.datetime('Datetime').optional()
      const table = await io.select
        .table('Table', {
          data: [
            { a: 1, b: 2, c: 3 },
            { a: 4, b: 5, c: 6 },
            { a: 7, b: 8, c: 9 },
          ],
          minSelections: 1,
          maxSelections: 1,
        })
        .optional()

      await io.display.object('Date', {
        data: date,
      })

      await io.display.object('Datetime', {
        data: datetime,
      })

      return table?.[0]
    },
    disabled_inputs: async io => {
      await io.group([
        io.display.heading('Here are a bunch of disabled inputs'),
        io.input.text('Text input', {
          disabled: true,
          placeholder: 'Text goes here',
        }),
        io.input.datetime('Date & time', { disabled: true }),
        io.input.boolean('Boolean input', { disabled: true }),
        io.select.single('Select something', {
          options: [1, 2, 3],
          disabled: true,
        }),
        io.input.number('Number input', {
          disabled: true,
        }),
        io.input.email('Email input', { disabled: true }),
        io.input.richText('Rich text input', { disabled: true }),
        io.search('Search for a user', {
          disabled: true,
          renderResult: user => ({
            label: user.name,
            description: user.email,
          }),
          onSearch: async query => {
            return [
              {
                name: 'John Doe',
                email: 'johndoe@example.com',
              },
            ]
          },
        }),
        io.select.multiple('Select multiple of something', {
          options: [1, 2, 3],
          disabled: true,
        }),
        io.select.table('Select from table', {
          data: [
            {
              album: 'Exile on Main Street',
              artist: 'The Rolling Stones',
              year: 1972,
            },
            {
              artist: 'Michael Jackson',
              album: 'Thriller',
              year: 1982,
            },
            {
              album: 'Enter the Wu-Tang (36 Chambers)',
              artist: 'Wu-Tang Clan',
              year: 1993,
            },
          ],
          disabled: true,
        }),
        io.input.date('Date input', { disabled: true }),
        io.input.time('Time input', { disabled: true }),
        io.input.file('File input', { disabled: true }),
      ])

      return 'Done!'
    },
    readonly_inputs: async io => {
      let i = 0

      while (i < 2) {
        const responses = await io.group([
          io.input
            .text('Empty text input', {
              placeholder: 'Text goes here',
            })
            .optional(),
          io.input.text('Text input', {
            placeholder: 'Text goes here',
            defaultValue: 'Default value',
          }),
          io.input.datetime('Date & time').optional(),
          io.input.datetime('Date & time', {
            defaultValue: new Date(),
          }),
          io.input.boolean('Boolean input').optional(),
          io.input.boolean('Boolean input', { defaultValue: null }),
          io.select
            .single('Select something', {
              options: [1, 2, 3],
            })
            .optional(),
          io.select.single('Select something', {
            options: [1, 2, 3],
            defaultValue: 1,
          }),
          io.input.number('Number input', { defaultValue: null }).optional(),
          io.input.number('Number input', { defaultValue: 100 }),
          io.input.email('Email input').optional(),
          io.input.email('Email input', { defaultValue: 'hi@interval.com' }),
          io.input
            .richText('Rich text input', { defaultValue: null })
            .optional(),
          io.input.richText('Rich text input', {
            defaultValue: 'Hello world',
          }),
          io
            .search('Search for a user', {
              renderResult: user => ({
                label: user.name,
                description: user.email,
              }),
              onSearch: async query => {
                return [
                  {
                    name: 'John Doe',
                    email: 'johndoe@example.com',
                  },
                ]
              },
            })
            .optional(),
          io.select
            .multiple('Select multiple of something', {
              options: [1, 2, 3],
            })
            .optional(),
          io.select
            .table('Select from table', {
              data: [
                {
                  album: 'Exile on Main Street',
                  artist: 'The Rolling Stones',
                  year: 1972,
                },
                {
                  artist: 'Michael Jackson',
                  album: 'Thriller',
                  year: 1982,
                },
                {
                  album: 'Enter the Wu-Tang (36 Chambers)',
                  artist: 'Wu-Tang Clan',
                  year: 1993,
                },
              ],
            })
            .optional(),
          io.input.date('Date input').optional(),
          io.input.time('Time input').optional(),
          io.input.file('File input').optional(),
        ])

        console.debug(responses)

        i++
      }

      return 'Done!'
    },
    'long-return-string': async io => {
      return {
        date: new Date(),
        url: 'http://chart.apis.google.com/chart?chs=500x500&chma=0,0,100,100&cht=p&chco=FF0000%2CFFFF00%7CFF8000%2C00FF00%7C00FF00%2C0000FF&chd=t%3A122%2C42%2C17%2C10%2C8%2C7%2C7%2C7%2C7%2C6%2C6%2C6%2C6%2C5%2C5&chl=122%7C42%7C17%7C10%7C8%7C7%7C7%7C7%7C7%7C6%7C6%7C6%7C6%7C5%7C5&chdl=android%7Cjava%7Cstack-trace%7Cbroadcastreceiver%7Candroid-ndk%7Cuser-agent%7Candroid-webview%7Cwebview%7Cbackground%7Cmultithreading%7Candroid-source%7Csms%7Cadb%7Csollections%7Cactivity|Chart',
        something:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed sit amet quam in lorem sagittis accumsan malesuada nec mauris. Nulla cursus dolor id augue sodales, et consequat elit mattis. Suspendisse nec sollicitudin ex. Pellentesque laoreet nulla nec malesuada consequat. Donec blandit leo id tincidunt tristique. Mauris vehicula metus sed ex bibendum, nec bibendum urna tincidunt. Curabitur porttitor euismod velit sed interdum. Suspendisse at dapibus eros. Vestibulum varius, est vel luctus pellentesque, risus lorem ullamcorper est, a ullamcorper metus dolor eget neque. Donec sit amet nulla tempus, fringilla magna eu, bibendum tortor. Nam pulvinar diam id vehicula posuere. Praesent non turpis et nibh dictum suscipit non nec ante. Phasellus vulputate egestas nisl a dapibus. Duis augue lorem, mattis auctor condimentum a, convallis sed elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Pellentesque bibendum, magna vel pharetra fermentum, eros mi vulputate enim, in consectetur est quam quis felis.',
      }
    },
    // 'progress-through-long-list': async io => {
    //   const resp = await io.experimental.progressThroughList(
    //     'Here are some items',
    //     ['Dan', 'Alex', 'Jacob'],
    //     async person => {
    //       await sleep(1000)
    //       return `Hi, ${person}!`
    //     }
    //   )
    //
    //   console.log('done!', resp)
    // },
    noInteractiveElements: async io => {
      await io.display.heading('I block :(')
      console.log('done!')
    },
    dynamic_group: async io => {
      const promises = [
        io.input.text('Your name'),
        io.input.number('Pick a number').optional(),
      ]

      const resp = await io.group(promises)

      console.log(resp)

      const obj = {
        text: io.input.text('Text'),
        num: io.input.number('Number'),
      }

      const objResp = await io.group(obj)
    },
    object_group: async io => {
      const resp = await io.group({
        name: io.input.text('Name'),
        email: io.input.email('Email'),
        num: io.input.number('Number').optional(),
        _disp: io.display.markdown('---'),
      })

      const { name, email, num } = resp

      return {
        name,
        email,
        num,
      }
    },
    optional_values: async io => {
      const [name, num, color] = await io.group([
        io.input.text('Your name'),
        io.input.number('Pick a number').optional(),
        io.select
          .single('Your favorite color', {
            options: [
              {
                label: 'Red',
                value: 'red',
              },
              {
                label: 'Blue',
                value: 'blue',
              },
              {
                label: 'Orange',
                value: 'orange',
              },
            ],
          })
          .optional(),
      ])

      const table = await io.select
        .table('Table', {
          data: [
            { a: 1, b: 2, c: 3 },
            { a: 4, b: 5, c: 6 },
            { a: 7, b: 8, c: 9 },
          ],
          minSelections: 1,
          maxSelections: 1,
        })
        .optional()

      return {
        Name: name,
        Number: num ?? 'No number selected',
        'Favorite color': color?.label ?? 'Unknown',
        Selected: JSON.stringify(table),
      }
    },
    'unauthorized-error': unauthorized,
    bare_string_return: async () => {
      return 'Hello, Interval!'
    },
    bare_list_return: async io => {
      return await io.group([
        io.input.text('Text'),
        io.input.number('Number'),
        io.input.boolean('Boolean'),
      ])
    },
    petr_repro: async () => {
      // Data will be undefined if you just click "continue" without modifying the form.
      const data = await io.select.single('Some field', {
        options: [],
        defaultValue: { label: 'my label', value: 'my_value' },
      })

      // This should be an object equal to the defaultValue
      console.log('data', data)

      await io.display.object('Return', {
        data: { mySuperValue: data || 'No data' },
      })
    },
    metadata: async (io, ctx) => {
      const data: EventualMetaItem[] = [
        {
          label: 'Is true',
          value: true,
        },
        {
          label: 'Is false',
          value: false,
        },
        {
          label: 'Is null',
          value: null,
        },
        {
          label: 'Is undefined',
          value: undefined,
        },
        {
          label: 'Is empty string',
          value: '',
        },
        {
          label: 'Is a promise',
          value: new Promise(async resolve => {
            await sleep(2000)
            resolve('Done!')
          }),
        },
        {
          label: 'Throws an error',
          value: new Promise(() => {
            throw new Error('Oops!')
          }),
        },
        {
          label: 'Is a function',
          value: () => 'Called it',
        },
        {
          label: 'Is an async function',
          value: async () => {
            await sleep(3500)
            return 'Did it'
          },
        },
        {
          label: 'Is long string',
          value:
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed sit amet quam in lorem',
        },
        {
          label: 'Is number 15',
          value: 15,
        },
        {
          label: 'Is string',
          value: 'Hello',
        },
        {
          label: 'Action link',
          value: 'Click me',
          action: 'helloCurrentUser',
          params: { message: 'Hello from metadata!' },
        },
        {
          label: 'External link',
          value: 'Click me',
          url: 'https://interval.com',
        },
        {
          label: 'Image',
          value: 'Optional caption',
          image: new Promise(resolve => {
            sleep(1500).then(() => {
              resolve({
                url: 'https://picsum.photos/200/300',
                size: 'small',
              })
            })
          }),
        },
      ]

      await io.group([
        io.display.heading(`Grid view`),
        io.display.metadata('Metadata grid label', { data }),
        io.display.heading(`List view`),
        io.display.metadata('', {
          layout: 'list',
          data,
        }),
        io.display.heading(`Card view`),
        io.display.metadata('', {
          layout: 'card',
          data,
        }),
      ])
    },
    code: async () => {
      await io.group([
        io.input.text('Text input'),
        io.display.code('Code from string', {
          code: 'console.log("Hello, world!")',
          language: 'typescript',
        }),
        io.display.code('Code from file', {
          code: fs.readFileSync('./src/examples/basic/unauthorized.ts', {
            encoding: 'utf8',
          }),
        }),
        io.display.markdown(
          `**Code in Markdown**
          
          ~~~ts
          const foo: string = 'bar'
          if (foo === 'bar') {
            console.log('foo is bar')
          } else {
            console.log('foo is not bar')
          }
          ~~~`
        ),
        io.display.table('In a table', {
          data: [
            {
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
          ],
        }),
      ])
    },
    images: async () => {
      await io.group([
        io.display.image('Image via url', {
          url: 'https://media.giphy.com/media/26ybw6AltpBRmyS76/giphy.gif',
          alt: "Man makes like he's going to jump on a skateboard but doesn't",
          width: 'medium',
        }),
        io.display.image('Image via buffer', {
          buffer: fs.readFileSync('./src/examples/static/fail.gif'),
          alt: 'Wile E. Coyote pulls a rope to launch a boulder from a catapult but it topples backwards and crushes him',
        }),
      ])
    },
    videos: async () => {
      const [url] = await io.group([
        io.input.url('URL for video').optional(),
        io.display.video('Video via url', {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/The_Kid_scenes.ogv',
          size: 'large',
          muted: true,
        }),
        io.display.video('Video via buffer', {
          loop: true,
          buffer: fs.readFileSync('./src/examples/static/canyon.mp4'),
          size: 'large',
        }),
      ])

      if (url) {
        await io.display.video('Portrait video', {
          url: url.toString(),
          size: 'medium',
        })
      }
    },
    enter_two_integers: async io => {
      const num1 = await io.input.number('Enter a number')

      const num2 = await io.input.number(
        `Enter a second number that's greater than ${num1}`,
        {
          min: num1 + 1,
        }
      )

      return { num1, num2, sum: num1 + num2 }
    },
    enter_two_numbers: async io => {
      const num1 = await io.input.number('Enter a number')

      const num2 = await io.input.number(
        `Enter a second number that's greater than ${num1}`,
        {
          min: num1 + 0.01,
          decimals: 2,
        }
      )

      return { num1, num2, sum: num1 + num2 }
    },
    logs: async (_, ctx) => {
      for (let i = 0; i < 10; i++) {
        await ctx.log('Log number', i)
        await sleep(500)
      }
    },
    logTest: async (io, ctx) => {
      ctx.log(new Date().toUTCString())
      const name = await io.input.text('Your name')
      ctx.log(new Date().toUTCString())
      const email = await io.input.email('Your email')

      ctx.log('Received', { name, email })

      ctx.log('Data types: ', true, null, undefined, [1, 2, 3], {
        a: 1,
        b: '2',
      })

      const itemsInQueue = 100
      await ctx.loading.start({
        itemsInQueue,
      })

      for (let i = 0; i < itemsInQueue; i++) {
        await sleep(100)
        ctx.log(i)
        await ctx.loading.completeOne()
        await ctx.notify({
          title: `Item ${i}`,
          message: `Hello, ${name}!`,
          delivery: [{ to: email }],
        })
      }

      return { name, email }
    },
    confirmBeforeDelete: async (io, ctx) => {
      const email = await io.input.email('Enter an email address', {
        defaultValue: 'hello@interval.com',
      })

      const shouldDelete = await io.confirm(`Delete this user?`, {
        helpText: 'All of their data will be removed.',
      })

      if (!shouldDelete) {
        ctx.log('Canceled by user')
        return
      }

      await ctx.loading.start({
        label: 'Fetching users...',
        description: 'This may take a while...',
      })
      await sleep(1500)
      await ctx.loading.update(
        `Deleted ${Math.floor(Math.random() * 100)} post drafts`
      )
      await sleep(1500)
      await ctx.loading.update('Skipped 13 published posts')
      await sleep(700)
      await ctx.loading.update('Deleted 13 comments')
      await sleep(1000)

      return { email }
    },
    helloCurrentUser: {
      name: 'Hello, current user!',
      description: '👋',
      handler: async () => {
        console.log(ctx.params)

        let heading = `Hello, ${ctx.user.firstName} ${ctx.user.lastName}`

        if (ctx.params.message) {
          heading += ` (Message: ${ctx.params.message})`
        }

        return heading
      },
    },
    dates: async io => {
      const [date, time, datetime] = await io.group([
        io.input.date('Enter a date', {
          min: {
            year: 2020,
            month: 1,
            day: 1,
          },
          max: {
            year: 3000,
            month: 12,
            day: 30,
          },
        }),
        io.input.time('Enter a time', {
          min: {
            hour: 8,
            minute: 30,
          },
          max: {
            hour: 20,
            minute: 0,
          },
        }),
        io.input.datetime('Enter a datetime', {
          defaultValue: new Date(),
          min: new Date(),
        }),
        io.input.text('Text input'),
      ])

      await io.display.object('Result', { data: { date, time, datetime } })

      return datetime
    },
    validityTester: async io => {
      await io
        .group([
          io.input.number('Enter a number'),
          io.input.number('Enter a second number').optional(),
          io.input
            .text('First name', {
              maxLength: 20,
            })
            .validate(async result => {
              await sleep(2000)
              if (result !== 'Jacob') return 'Must be Jacob.'
            }),
          io.input
            .text('Last name', {
              minLength: 5,
            })
            .optional(),
          io.input.email('Email'),
          io.input.email('Backup email').optional(),
        ])
        .validate(([, , firstName, lastName]) => {
          if (lastName === undefined && firstName === 'Jacob') return
          if (firstName === 'Jacob' && lastName !== 'Mischka') {
            return 'Last name is not correct.'
          }
        })
    },
    optionalCheckboxes: async io => {
      const options = [
        {
          value: 0,
          label: 0,
          extraData: 'A',
        },
        {
          value: new Date(2022, 6, 1),
          label: new Date(2022, 6, 1),
          extraData: 'B',
        },
        {
          value: true,
          label: true,
          extraData: 'C',
        },
      ]

      const defaultValue = await io.select.multiple('Select zero or more', {
        options,
      })

      ctx.log(defaultValue)

      const selected = await io.select
        .multiple('Modify the selection, selecting between 1 and 2', {
          options,
          defaultValue,
          minSelections: 1,
          maxSelections: 2,
        })
        .optional()

      ctx.log(selected)
    },
    update_email_for_user: editEmailForUser,
    richText: async io => {
      const [body, to] = await io.group([
        io.input.richText('Enter email body', {
          defaultValue: '<h2>Welcome to Interval!</h2><p>Enjoy your stay.</p>',
          helpText: 'This will be sent to the user.',
        }),
        io.input.email('Email address'),
      ])

      await io.display.markdown(`
          ## You entered:

          To: ${to}

          ~~~html
          ${body}
          ~~~
      `)
    },
    ImportUsers: async io => {
      await io.display.table('Users', {
        data: [
          {
            email: 'carsta.rocha@example.com',
            phone_number: '(60) 1416-4953',
            birthdate: '1993-08-04',
            first_name: 'carsta',
            last_name: 'rocha',
            photo: 'photos/21351234.jpg',
            website_url: 'https://example.com',
          },
          {
            email: 'irene.morales@example.org',
            phone_number: '625-790-958',
            birthdate: '1982-04-28',
            first_name: 'irene',
            last_name: 'morales',
            picture: 'photos/8321527.jpg',
            website_url: 'https://example.org',
          },
        ],
        columns: [
          {
            label: 'Name',
            renderCell: row => `${row.first_name} ${row.last_name}`,
          },
          {
            label: 'Birth date',
            renderCell: row => {
              const [y, m, d] = row.birthdate.split('-').map(s => Number(s))
              const birthDate = new Date(y, m - 1, d)
              return {
                label: birthDate.toLocaleDateString(),
                value: birthDate,
              }
            },
          },
          {
            label: 'Website',
            renderCell: row => ({
              label: row.website_url,
              url: row.website_url,
            }),
          },
          {
            label: 'Edit action',
            renderCell: row => ({
              label: 'Edit user',
              action: 'edit_user',
              params: {
                email: row.email,
              },
            }),
          },
        ],
        orientation: 'horizontal',
      })
    },
    edit_user: async (io, ctx) => {
      const { email } = ctx.params
      await io.display.markdown(
        `Perform work for the user with the email \`${email}\``
      )
      return { email }
      // const user = lookupUserByEmail(email)
      // Edit user
    },
    'Display-Might-Return-Automatically': async io => {
      await io.group([
        io.display.markdown(`
          After you press continue, a long running task will start.
        `),
        io.input.text('Your name'),
      ])

      console.log(1)

      await io.display.heading('Maybe? Blocking until you press continue')

      await sleep(2000)

      io.display
        .markdown(`Can always hack immedate returns with \`.then()\``)
        .then(() => {})

      await sleep(2000)

      await io.group([
        io.display.markdown('Displays in a group'),
        io.display.markdown(
          'Will block unless auto-continue feature flag is set'
        ),
      ])

      console.log(2)

      await sleep(2000)
      console.log('Done!')
    },
    Render_markdown: async io => {
      await io.group([
        io.display.markdown(`
- one
  - two
    - three
      - four
        `),
        // contents taken from tailwind typography demo
        io.display.markdown(`
          # What to expect from here on out

          _This has been adapted from the [Tailwind](https://tailwindcss.com) typography plugin demo._

          What follows from here is just a bunch of absolute nonsense I've written to demo typography. It includes every sensible typographic element I could think of, like **bold text**, unordered lists, ordered lists, code blocks, block quotes, and _even italics_.

          It's important to cover all of these use cases for a few reasons:

          1. We want everything to look good out of the box.
          2. Really just the first reason, that's the whole point of the plugin.
          3. Here's a third pretend reason though a list with three items looks more realistic than a list with two items.

          Now we're going to try out another header style.

          ## Typography should be easy

          So that's a header for you — with any luck if we've done our job correctly that will look pretty reasonable.

          Something a wise person once told me about typography is:

          > Typography is pretty important if you don't want your stuff to look like trash. Make it good then it won't be bad.

          Now I'm going to show you an example of an unordered list to make sure that looks good, too:

          - Here is the first item in this list.
          - Let's try longer, more complex list items:
            - This is a sub-list-item.
          - And this is the last item in the list.

          ### What does code look like?

          Code blocks should look okay by default, although most people will probably want to use \`io.display.code\`:

          \`\`\`typescript
          new Action({
            name: 'Render markdown',
            handler: async () => {
              // ...
            }
          })
          \`\`\`

          #### And finally, an H4

          And that's the end of this demo.
        `),
        io.select.multiple('Erase user data', {
          options: [
            {
              label: 'Erase',
              value: 'erase',
            },
          ],
        }),
      ])
    },
    Render_object: async io => {
      await io.group([
        io.display.object('User', {
          data: {
            name: 'Interval',
            action: { isTrue: true, createdAt: new Date() },
          },
        }),
        io.select.multiple('Continue?', {
          options: [
            {
              label: 'Continue',
              value: 'Continue',
            },
          ],
        }),
      ])
    },
    Progress_steps: async (io, ctx) => {
      await ctx.loading.start('Fetching users...')

      // await sleep(1000)

      const users = await fakeDb
        .find('')
        .then(res => res.map(mapToIntervalUser).slice(0, 3))

      await io.display.table('Users to process', {
        data: users,
      })

      const shouldContinue = await io.confirm(
        'Are you sure you want to delete these users?'
      )

      if (!shouldContinue) {
        throw new Error('Did not continue')
      }

      await ctx.loading.start({
        label: 'Updating users',
        itemsInQueue: users.length,
      })
      for (const _ of users) {
        await sleep(1000)
        await ctx.loading.completeOne()
      }

      // final text input to make sure loading isn't getting clobbered
      await io.input.text('Your name').optional()

      await sleep(1000)
    },
    loading_dos: async () => {
      const itemsInQueue = 100_000
      await ctx.loading.start({
        label: 'Migrating users',
        description: 'There are a lot, but they are very fast',
        itemsInQueue,
      })

      for (let i = 0; i < itemsInQueue; i++) {
        await ctx.loading.completeOne()
      }
    },
    loading_clobber: async () => {
      await ctx.loading.start('Loading...')

      await sleep(500)

      sleep(200).then(() => {
        ctx.loading.update({ description: 'Still loading!' })
      })

      await io.display.markdown('An IO input')

      await ctx.loading.start('Loading again...')

      await sleep(500)
    },
    log_dos: async () => {
      for (let i = 0; i < 2000; i++) {
        ctx.log(i)
      }
    },
    echoParams: async (io, ctx) => {
      ctx.log(ctx.params)
      await io.display.object('Params', {
        data: ctx.params,
      })
      return ctx.params
    },
    invalid_props: async io => {
      await io.select.single('This is broken', {
        options: [
          { label: 'Works', value: 'works' },
          // @ts-expect-error
          { label: "Doesn't" },
        ],
      })
    },
    a_readonly_demo: async io => {
      await io.group(
        [
          io.input.text('Full name', { defaultValue: 'Interval' }),
          io.input.email('Email address', {
            defaultValue: 'hello@interval.com',
          }),
          io.input.date('Start date', {
            defaultValue: new Date(),
          }),
          io.input.boolean('Subscribe to newsletter?', {
            defaultValue: true,
          }),
        ],
        {
          continueButton: { label: 'Start trial' },
        }
      )

      await io.group([
        io.input.text('User ID', {
          disabled: true,
          defaultValue: 'cle6jrr5s0000ncl74lza8q6v',
          helpText: 'This is a disabled io.input.text',
        }),
        io.display.table('Associated users', {
          data: [
            {
              email: 'carsta.rocha@example.com',
              phone_number: '(60) 1416-4953',
              birthdate: '1993-08-04',
              first_name: 'carsta',
              last_name: 'rocha',
              photo: 'photos/21351234.jpg',
              website_url: 'https://example.com',
            },
            {
              email: 'irene.morales@example.org',
              phone_number: '625-790-958',
              birthdate: '1982-04-28',
              first_name: 'irene',
              last_name: 'morales',
              picture: 'photos/8321527.jpg',
              website_url: 'https://example.org',
            },
          ],
        }),
      ])

      return 'Done!'
    },
    append_ui_scroll_demo: async io => {
      let i = 0
      while (i < 3) {
        await io.group([
          io.input
            .number('United States Dollar', {
              min: 10,
              currency: 'USD',
            })
            .optional(),
          io.input
            .number('Euro', {
              currency: 'EUR',
            })
            .optional(),
          io.input
            .number('Japanese yen', {
              currency: 'JPY',
              decimals: 3,
            })
            .optional(),
        ])
        i++
      }
    },
    error: async io => {
      class CustomError extends Error {
        name = 'CustomError'
      }

      const errors = [
        new Error('This is a regular error'),
        new TypeError('This is a type error.'),
        new CustomError('This is a custom error!'),
      ]

      const selected = await io.select.single('Select an error', {
        options: errors.map((e, i) => ({ label: e.name, value: i.toString() })),
      })

      throw errors[Number(selected.value)]
    },
    money: async io => {
      const [usd, eur, jpy] = await io.group([
        io.input.number('United States Dollar', {
          min: 10,
          currency: 'USD',
        }),
        io.input.number('Euro', {
          currency: 'EUR',
        }),
        io.input.number('Japanese yen', {
          currency: 'JPY',
          decimals: 3,
        }),
      ])

      return { usd, eur, jpy }
    },
    actionLinks,
    globalIO: async () => {
      await io.display.markdown(`Hello from \`${ctx.action.slug}!\``)
    },
    notifications: async (io, ctx) => {
      let deliveries: NotificationDeliveryInstruction[] = []

      while (true) {
        const [_heading, to, method, moreDeliveries] = await io.group([
          io.display.heading("Let's send a notification"),
          io.input.text('to'),
          io.select
            .single('method', {
              options: [
                { label: 'SLACK', value: 'SLACK' },
                { label: 'EMAIL', value: 'EMAIL' },
              ],
            })
            .optional(),
          io.input.boolean('Send to another destination?'),
        ])
        deliveries.push({
          to,
          method: method?.value as 'SLACK' | 'EMAIL' | undefined,
        })
        ctx.log('Current delivery array:', deliveries)

        if (!moreDeliveries) break
      }

      const [message, title] = await io.group([
        io.input.text('What message would you like to send?'),
        io.input
          .text('Optionally provide a title', {
            helpText: 'This will otherwise default to the name of the action',
          })
          .optional(),
      ])

      await ctx.notify({
        message,
        title,
        delivery: deliveries,
      })

      return { message: 'OK, notified!' }
    },
    uploads: new Page({
      name: 'Uploads',
      routes: {
        custom_destination: async io => {
          const customDestinationFile = await io.input.file(
            'Upload an image!',
            {
              helpText: 'Will be uploaded to the custom destination.',
              allowedExtensions: ['.gif', '.jpg', '.jpeg', '.png'],
              generatePresignedUrls: async ({ name }) => {
                const urlSafeName = name.replace(/ /g, '-')
                const path = `custom-endpoint/${new Date().getTime()}-${urlSafeName}`

                return generateS3Urls(path)
              },
            }
          )

          console.log(await customDestinationFile.url())

          const { text, json, buffer, url, ...rest } = customDestinationFile

          return {
            ...rest,
            url: await url(),
            text: rest.type.includes('text/')
              ? await text().catch(err => {
                  console.log('Invalid text', err)
                  return undefined
                })
              : undefined,
            json: rest.type.includes('text/')
              ? await json()
                  .then(obj => JSON.stringify(obj))
                  .catch(err => {
                    console.log('Invalid JSON', err)
                    return undefined
                  })
              : undefined,
          }
        },
        multiple: async io => {
          const files = await io.input
            .file('Upload an image!', {
              helpText:
                'Will be uploaded to Interval and expire after the action finishes running.',
              allowedExtensions: ['.gif', '.jpg', '.jpeg', '.png'],
            })
            .multiple()
            .optional()

          if (!files) return 'None selected.'

          await io.group(
            (
              await Promise.all(
                files.map(async file => [
                  io.display.image(file.name, {
                    url: await file.url(),
                  }),
                ])
              )
            ).map(([p]) => p)
          )

          return Object.fromEntries(files.map((file, i) => [i, file.name]))
        },
      },
    }),
    advanced_data: async io => {
      const data = {
        bigInt: BigInt(5),
        map: new Map([
          ['a', 1],
          ['b', 2],
        ]),
        set: new Set(['a', 'b', 'c']),
      }

      await io.display.object('Object', {
        data,
      })

      return data.bigInt
    },
    malformed: async io => {
      // @ts-expect-error: Ensuring we can handle invalid calls
      await io.input.text(new Error(), {
        this: BigInt(12),
        // @ts-expect-error: Ensuring we can handle invalid calls
        something: this.something,
      })
    },
    badMessage: async () => {
      const client = new IntervalClient(interval, interval.config)

      // @ts-expect-error: Intentionally using private method
      await client.initializeConnection()

      // @ts-expect-error: Intentionally using protected method
      await client.__dangerousInternalSend('NONEXISTANT', {
        gibberish: '1234',
        error: new Error(),
      })
    },
    url: async () => {
      const url = await io.input.url('Enter a URL', {
        helpText: 'This is help text',
        placeholder: 'https://google.com',
        allowedProtocols: ['https'],
      })

      return { url: url.href }
    },
    redirect: async () => {
      const [url, , route, paramsStr] = await io.group([
        io.input.url('Enter a URL').optional(),
        io.display.markdown('--- or ---'),
        io.input.text('Enter an action slug').optional(),
        io.input
          .text('With optional params', {
            multiline: true,
          })
          .optional(),
      ])

      let params = undefined
      if (url) {
        await ctx.redirect({ url: url.toString() })
      } else if (route) {
        if (paramsStr) {
          try {
            params = JSON.parse(paramsStr)
          } catch (err) {
            ctx.log('Invalid params object', paramsStr)
          }
        }

        await ctx.redirect({ route, params })
      } else {
        throw new Error('Must enter either a URL or an action slug')
      }

      console.log({
        url,
        route,
        params,
      })

      return {
        url: url?.toString(),
        route,
        paramsStr,
      }
    },
    continue_button: async () => {
      const url = await io.group([io.input.text('Important data')], {
        continueButton: {
          label: 'Delete the data',
          theme: 'danger',
        },
      })

      return 'All done!'
    },
    with_choices: async () => {
      let { choice: singleChoice, returnValue: singleReturnValue } =
        await io.input
          .number('Enter a number')
          .optional()
          .withChoices([
            { label: 'Make it negative', theme: 'danger', value: 'negative' },
            { label: 'Do nothing', value: 'nothing' },
            'Think about it for a while',
            'Restart',
          ])

      if (singleChoice === 'Restart') {
        await ctx.redirect({ route: 'with_choices' })
        return
      }

      if (singleReturnValue && singleChoice === 'negative') {
        singleReturnValue = -singleReturnValue
      }

      await sleep(2000)

      await io.display
        .heading(`The number is now ${singleReturnValue}`)
        .withChoices([
          {
            label: 'OK!',
            value: 'ok',
          },
        ])

      const { choice: fileChoice, returnValue: fileReturnValue } =
        await io.input
          .file('Upload a file')
          .withChoices(['Encrypt'])
          .multiple()
          .optional()

      ctx.log('choice', fileChoice)
      ctx.log('returnValue', fileReturnValue)

      const {
        choice: groupChoice,
        returnValue: { data: groupReturn },
      } = await io
        .group({ data: io.input.text('Important data') })
        .withChoices([
          {
            label: 'Delete the data',
            value: 'delete',
            theme: 'danger',
          },
          {
            label: 'Cancel',
            value: 'cancel',
            theme: 'secondary',
          },
        ])

      return {
        groupChoice,
        groupReturn,
      }
    },
    select_single: async () => {
      const selected = await io.select.single('Select an item', {
        options: [
          { label: 'Item 1', value: 1 },
          { label: 'Item 2', value: 2 },
          { label: 'Item 3', value: 3 },
          { label: 'Item 4', value: 4 },
          { label: 'Item 5', value: 5 },
          { label: 'Item 6', value: 6 },
          { label: 'Item 7', value: 7 },
          { label: 'Item 8', value: 8 },
        ],
      })

      return selected
    },
    tables: new Page({
      name: 'Tables',
      routes: table_actions,
    }),
    grids: gridsPage,
    confirm_identity: confirmIdentity,
  },
})

interval.listen()
