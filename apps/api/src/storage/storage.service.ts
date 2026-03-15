import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const useMinio = this.config.get<string>('USE_MINIO') !== 'false';
    this.client = new S3Client({
      region: this.config.get<string>('AWS_REGION') ?? 'us-east-1',
      ...(useMinio && {
        endpoint: this.config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9000',
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.config.get<string>('MINIO_ROOT_USER') ?? 'minioadmin',
          secretAccessKey: this.config.get<string>('MINIO_ROOT_PASSWORD') ?? 'minioadmin',
        },
      }),
      ...(!useMinio && {
        credentials: {
          accessKeyId: this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
        },
      }),
    });
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'agentforge-datasets';
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getStream(key: string): Promise<Readable> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return res.Body as Readable;
  }

  async getBuffer(key: string): Promise<Buffer> {
    const stream = await this.getStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  buildKey(
    workspaceId: string,
    datasetId: string,
    versionNumber: number,
    filename: string,
  ): string {
    return `datasets/${workspaceId}/${datasetId}/v${versionNumber}/${filename}`;
  }
}
