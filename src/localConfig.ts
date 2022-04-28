import path from 'path'
import fs from 'fs'
import z from 'zod'
import util from 'util'

const writeFile = util.promisify(fs.writeFile)

const intervalConfigPath = path.join(__dirname, '.interval.config.json')
console.log({ intervalConfigPath })

function getIntervalConfigFile() {}

console.log(getIntervalConfigFile())

const SCHEMA = z.object({
  apiKey: z.string(),
})

export default {
  get() {
    try {
      const configFile = SCHEMA.parse(require(intervalConfigPath))
      return configFile
    } catch (e) {
      return null
    }
  },
  write(config: z.infer<typeof SCHEMA>) {
    return writeFile(intervalConfigPath, JSON.stringify(config), 'utf-8')
  },
}
