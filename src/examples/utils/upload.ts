import {
  AWS_REGION,
  AWS_KEY_ID,
  AWS_KEY_SECRET,
  AWS_S3_IO_BUCKET,
} from '../../env'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const s3Client = new S3Client({
  region: AWS_REGION ?? 'us-west-1',
  credentials: {
    accessKeyId: AWS_KEY_ID,
    secretAccessKey: AWS_KEY_SECRET,
  },
})

export async function generateUploadUrl(key: string) {
  const command = new PutObjectCommand({
    Bucket: AWS_S3_IO_BUCKET,
    Key: key,
  })

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  })

  return signedUrl
}

export function generateDownloadUrl(path: string) {
  return `https://${AWS_S3_IO_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${path}`
}
