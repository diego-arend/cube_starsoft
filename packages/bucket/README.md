# @turborepo/bucket

This package provides an abstraction to interact with object storage (S3-compatible). It uses AWS SDK v3 `S3Client` by default and can be configured to target a MinIO endpoint for development.

## Quick start

- Add `BucketModule.forRoot()` to your `AppModule` imports.
- Inject `BucketService` or `BUCKET_CLIENT` token where needed.

## API

- `BucketService#upload(key, body, options)` - upload bytes or string
- `BucketService#download(key)` - get Buffer
- Server-mediated uploads: use backend upload flow (server validates and uploads to the bucket) instead of presigned URLs.

## Configuration

- `S3_BUCKET` - default bucket
- `S3_ENDPOINT` - if present, used as custom endpoint (MinIO)
- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`
- `S3_FORCE_PATH_STYLE` - when using MinIO, set to true

Caveats

- Bucket names containing dots (e.g. `my.bucket`) may lead to TLS certificate hostname mismatches when using virtual-hosted-style requests (the default in AWS S3). If you use dotted bucket names in production, prefer `S3_FORCE_PATH_STYLE=true` or avoid dots in bucket names to prevent HTTPS/TLS issues.
- Uploads with string bodies must include a Content-Length header to avoid chunked transfer and signature mismatches with some S3 endpoints; the adapter sets ContentLength for both Buffer and string bodies.
- Avoid logging raw SDK error objects in production; they may contain rich request details; prefer status/message-only logging or ensure logs are access-controlled.

## Testing

Use `InMemoryAdapter` (located under `packages/bucket/src/test/`) for unit tests or start a MinIO container for integration tests.
