import { z } from 'zod'

import 'dotenv/config'

const schema = z.object({
  DEMO_API_KEY: z.string(),
  DEMO_PROD_API_KEY: z.string(),
  AWS_KEY_ID: z.string().optional(),
  AWS_KEY_SECRET: z.string().optional(),
  AWS_S3_IO_BUCKET: z.string().optional(),
  AWS_REGION: z.string().optional(),
})

const validated = schema.parse(process.env)

export default validated
