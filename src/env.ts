import { z } from 'zod'
import dotenv from 'dotenv'

try {
  dotenv.config({
    debug: true,
  })
} catch (err) {
  console.error('Failed loading .env', err)
}

const schema = z.object({
  DEMO_API_KEY: z.string(),
  DEMO_PROD_API_KEY: z.string(),
  S3_KEY_ID: z.string().optional(),
  S3_KEY_SECRET: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
})

const validated = schema.parse(process.env)

export default validated
