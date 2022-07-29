import {
  AWS_REGION,
  AWS_KEY_ID,
  AWS_KEY_SECRET,
  AWS_S3_IO_BUCKET,
} from '../../env'
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import * as urlParser from '@aws-sdk/url-parser'

export async function generateS3Urls(key: string) {
  if (!AWS_KEY_ID || !AWS_KEY_SECRET || !AWS_S3_IO_BUCKET) {
    throw new Error('Missing AWS credentials')
  }

  const s3Client = new S3Client({
    region: AWS_REGION ?? 'us-west-1',
    credentials: {
      accessKeyId: AWS_KEY_ID,
      secretAccessKey: AWS_KEY_SECRET,
    },
  })

  const command = new PutObjectCommand({
    Bucket: AWS_S3_IO_BUCKET,
    Key: key,
  })

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  })

  const url = new URL(uploadUrl)
  const downloadUrl = url.origin + url.pathname

  return { uploadUrl, downloadUrl }
}
