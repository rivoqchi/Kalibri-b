import {
  BadRequestException,
  Controller,
  GoneException,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';

type UploadedImage = {
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
};

@Controller('api/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /** Browser uploads — server PUTs to R2 (avoids bucket CORS). */
  @Post('upload')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: UploadedImage | undefined,
    @Query('folder') folder = 'products',
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file required');
    }
    return this.mediaService.uploadObject(
      file.buffer,
      file.mimetype || 'image/jpeg',
      folder,
    );
  }

  /** Deprecated direct-to-R2 presign (requires bucket CORS). */
  @Post('upload-url')
  @UseGuards(JwtAuthGuard, AdminGuard)
  uploadUrl(): never {
    throw new GoneException(
      'Use POST /api/media/upload (multipart). Hard-refresh the admin page.',
    );
  }
}
