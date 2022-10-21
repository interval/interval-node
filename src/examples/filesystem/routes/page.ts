import fs from 'fs'
import { Page, Layout, io } from '../../../experimental'

export default new Page({
  name: 'Page definition in non-index',
  description: 'This filename is page.ts',
  handler: async () => {
    return new Layout.Basic({
      title: 'routes/page.ts',
      children: [
        io.display.code("This file's source code", {
          code: fs.readFileSync(__filename, { encoding: 'utf8' }),
        }),
      ],
    })
  },
  routes: {
    inline: async () => {
      return 'Hello!'
    },
  },
})
