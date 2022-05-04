import path from 'path'
import fs from 'fs'
import z from 'zod'
import util from 'util'

const writeFile = util.promisify(fs.writeFile)
const removeFile = util.promisify(fs.rm)
const readFile = util.promisify(fs.readFile)

const intervalConfigPath = path.join(__dirname, '.interval.config.json')

const SCHEMA = z.object({
  ghostOrgId: z.string(),
})

export default {
  async get() {
    try {
      const contents = await readFile(intervalConfigPath, 'utf-8')
      const configFile = SCHEMA.parse(JSON.parse(contents))
      return configFile
    } catch (e) {
      return null
    }
  },
  write(config: z.infer<typeof SCHEMA>) {
    return writeFile(intervalConfigPath, JSON.stringify(config), 'utf-8')
  },
  async clear() {
    try {
      await removeFile(intervalConfigPath)
    } catch (e) {}
  },
}
