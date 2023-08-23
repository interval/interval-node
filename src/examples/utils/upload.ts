import env from '../../env'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export async function generateS3Urls(key: string) {
  if (!env.AWS_KEY_ID || !env.AWS_KEY_SECRET || !env.AWS_S3_IO_BUCKET) {
    throw new Error('Missing AWS credentials')
  }

  const s3Client = new S3Client({
    region: env.AWS_REGION ?? 'us-west-1',
    credentials: {
      accessKeyId: env.AWS_KEY_ID,
      secretAccessKey: env.AWS_KEY_SECRET,
    },
  })

  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_IO_BUCKET,
    Key: key,
  })

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  })

  const url = new URL(uploadUrl)
  const downloadUrl = url.origin + url.pathname

  return { uploadUrl, downloadUrl }
}
