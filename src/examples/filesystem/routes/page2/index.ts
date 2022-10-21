import fs from 'fs'
import { io, Page, Layout } from '../../../../experimental'

export default new Page({
  name: 'Default export Page',
  description: 'This has both inline and file-based actions',
  unlisted: false,
  routes: {
    inline: async () => 'Inline!',
  },
  handler: async () =>
    new Layout.Basic({
      title: 'routes/page2/index.ts',
      children: [
        io.display.code("This file's source code", {
          code: fs.readFileSync(__filename, { encoding: 'utf8' }),
        }),
      ],
    }),
})
