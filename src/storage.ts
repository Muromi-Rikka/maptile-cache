import { S3Client } from "bun";

/**
 * S3 client instance for tile caching
 * @remarks
 * Configured using environment variables:
 * - S3_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID
 * - S3_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY
 * - S3_BUCKET or AWS_BUCKET
 * - S3_ENDPOINT or AWS_ENDPOINT
 * - S3_REGION or AWS_REGION (defaults to "us-east-1")
 */
export const s3 = new S3Client({
  accessKeyId: Bun.env.S3_ACCESS_KEY_ID || Bun.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: Bun.env.S3_SECRET_ACCESS_KEY || Bun.env.AWS_SECRET_ACCESS_KEY,
  bucket: Bun.env.S3_BUCKET || Bun.env.AWS_BUCKET,
  endpoint: Bun.env.S3_ENDPOINT || Bun.env.AWS_ENDPOINT,
  region: Bun.env.S3_REGION || Bun.env.AWS_REGION || "us-east-1",
});
