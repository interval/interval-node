import { EnvoyVariableSpec } from '@interval/envoy'

const vars: EnvoyVariableSpec[] = [
  'DEMO_API_KEY',
  { name: 'AWS_KEY_ID', isRequired: false },
  { name: 'AWS_KEY_SECRET', isRequired: false },
  { name: 'AWS_S3_IO_BUCKET', isRequired: false },
  { name: 'AWS_REGION', isRequired: false },
]

export default vars
