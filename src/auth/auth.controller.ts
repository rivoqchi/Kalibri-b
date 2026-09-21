import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ServiceUnavailableException,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { VerifyTelegramCodeDto } from './dto/verify-telegram-code.dto.js';
import { VerifyTelegramWebAppDto } from './dto/verify-telegram-webapp.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { TelegramBotService } from './telegram-bot.service.js';
import { JwtAuthGuard, type AuthedRequest } from './jwt-auth.guard.js';

type UploadedImage = {
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
};

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  @Get('telegram/bot')
  getBotInfo() {
    const username = this.telegramBotService.getBotUsername();
    if (!username) {
      throw new ServiceUnavailableException(
        'Telegram bot hozircha mavjud emas.',
      );
    }
    return {
      username,
      deepLink: `https://t.me/${username}`,
      ready: this.telegramBotService.isReady(),
    };
  }

  @Post('telegram/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@Body() dto: VerifyTelegramCodeDto) {
    return this.authService.verifyTelegramCode(dto.code);
  }

  @Post('telegram/webapp')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  verifyWebApp(@Body() dto: VerifyTelegramWebAppDto) {
    return this.authService.verifyTelegramWebApp(dto.initData);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest) {
    return this.authService.getMe(req.user!);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    return this.authService.updateMe(req.user!, dto);
  }

  @Get('me/photo')
  @UseGuards(JwtAuthGuard)
  async mePhoto(@Req() req: AuthedRequest) {
    const photo = await this.authService.getMePhoto(req.user!);
    return new StreamableFile(photo.buffer, {
      type: photo.contentType,
      disposition: 'inline',
    });
  }

  @Post('me/photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  updateMePhoto(
    @Req() req: AuthedRequest,
    @UploadedFile() file: UploadedImage | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Rasm');
    }
    return this.authService.updateMePhoto(req.user!, file);
  }
}
