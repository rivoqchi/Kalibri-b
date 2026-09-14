import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import { MediaService } from './media.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';

@Controller('api/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  @UseGuards(JwtAuthGuard, AdminGuard)
  uploadUrl(
    @Query('contentType') contentType = 'image/webp',
    @Query('folder') folder = 'products',
  ) {
    return this.mediaService.createUploadUrl(contentType, folder);
  }
}
