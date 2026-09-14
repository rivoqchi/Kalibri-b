import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

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

  async createUploadUrl(contentType: string, folder = 'products') {
    if (!this.client) {
      throw new ServiceUnavailableException('Cloudflare R2 is not configured');
    }
    if (!contentType.startsWith('image/')) {
      throw new BadRequestException('Only image uploads are allowed');
    }

    const bucket = this.config.get<string>('cloudflare.bucket') ?? 'kalibri-media';
    const publicUrl = this.config.get<string>('cloudflare.publicUrl');
    if (!publicUrl) {
      throw new ServiceUnavailableException('CLOUDFLARE_R2_PUBLIC_URL is required');
    }

    const ext = contentType.split('/')[1] ?? 'bin';
    const key = `${folder}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 600 });

    return {
      key,
      uploadUrl,
      publicUrl: `${publicUrl.replace(/\/$/, '')}/${key}`,
      expiresIn: 600,
    };
  }
}
