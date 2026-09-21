import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import {
  MEDIA_FOLDER_DIMENSIONS,
  assertFolderImageDimensions,
} from './image-dimensions.js';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {
    const accessKeyId = this.config.get<string>('cloudflare.accessKeyId');
    const secretAccessKey = this.config.get<string>('cloudflare.secretAccessKey');
    const endpoint =
      this.config.get<string>('cloudflare.endpoint') ||
      (this.config.get<string>('cloudflare.accountId')
        ? `https://${this.config.get<string>('cloudflare.accountId')}.r2.cloudflarestorage.com`
        : '');

    if (accessKeyId && secretAccessKey && endpoint) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      this.logger.warn('Cloudflare R2 is not fully configured');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.config.get<string>('cloudflare.publicUrl'));
  }

  private resolveUploadTarget(contentType: string, folder: string) {
    if (!this.client) {
      throw new ServiceUnavailableException('Cloudflare R2 is not configured');
    }
    if (!contentType.startsWith('image/')) {
      throw new BadRequestException('Only image uploads are allowed');
    }
    if (!(folder in MEDIA_FOLDER_DIMENSIONS)) {
      throw new BadRequestException('Invalid folder');
    }

    const bucket = this.config.get<string>('cloudflare.bucket') ?? 'kalibri-media';
    const publicUrl = this.config.get<string>('cloudflare.publicUrl');
    if (!publicUrl) {
      throw new ServiceUnavailableException('CLOUDFLARE_R2_PUBLIC_URL is required');
    }

    const ext = contentType.split('/')[1]?.split('+')[0] ?? 'bin';
    const key = `${folder}/${randomUUID()}.${ext}`;
    return {
      client: this.client,
      bucket,
      key,
      publicUrl: `${publicUrl.replace(/\/$/, '')}/${key}`,
    };
  }

  /** Server-side upload — browser never talks to R2 (no CORS). */
  async uploadObject(
    body: Buffer,
    contentType: string,
    folder = 'products',
  ) {
    try {
      assertFolderImageDimensions(folder, body);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Rasm',
      );
    }

    const { client, bucket, key, publicUrl } = this.resolveUploadTarget(
      contentType,
      folder,
    );

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return { key, publicUrl };
  }

  async createUploadUrl(contentType: string, folder = 'products') {
    const { client, bucket, key, publicUrl } = this.resolveUploadTarget(
      contentType,
      folder,
    );

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });

    return {
      key,
      uploadUrl,
      publicUrl,
      expiresIn: 600,
    };
  }
}
