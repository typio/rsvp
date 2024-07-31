import {
  S3Client,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand
} from '@aws-sdk/client-s3'
import mime from 'mime-types'
import {
  CloudFrontClient,
  CreateInvalidationCommand
} from '@aws-sdk/client-cloudfront'
import { readFileSync } from 'fs'

const BUCKET = 'cmon.rsvp'
const SOURCE_DIR = 'client/dist/'

const s3Client = new S3Client({
  region: Bun.env.AWS_REGION,
  credentials: {
    accessKeyId: Bun.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: Bun.env.AWS_SECRET_ACCESS_KEY
  }
})

console.log('Removing all files on bucket')

const listObjects = await s3Client.send(
  new ListObjectsV2Command({ Bucket: BUCKET })
)

if (listObjects.Contents)
  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: listObjects.Contents!.map(obj => ({ Key: obj.Key! }))
      }
    })
  )

console.log('Attempting to upload site...')
console.log(`Command: aws s3 sync ${SOURCE_DIR} s3://${BUCKET}/`)
const glob = new Bun.Glob(`${SOURCE_DIR}**/*`)

for await (const file of glob.scan('.')) {
  console.log(file)
  const fileContent = readFileSync(file)
  const contentType = mime.lookup(file) || 'application/octet-stream'
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: file.replace(SOURCE_DIR, ''),
      ContentType: contentType,
      Body: fileContent
    })
  )
}

console.log('S3 Upload complete')

console.log('Invalidating CloudFront distribution to get fresh cache')

const cloudfrontClient = new CloudFrontClient({
  region: Bun.env.AWS_REGION,
  credentials: {
    accessKeyId: Bun.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: Bun.env.AWS_SECRET_ACCESS_KEY
  }
})
await cloudfrontClient.send(
  new CreateInvalidationCommand({
    DistributionId: 'E3SQN0TK9Y0PMX',
    InvalidationBatch: {
      Paths: {
        Quantity: 1,
        Items: ['/*']
      },
      CallerReference: Date.now().toString()
    }
  })
)

console.log('Deployment complete')
