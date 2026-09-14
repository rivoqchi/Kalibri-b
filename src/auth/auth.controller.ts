import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { VerifyTelegramCodeDto } from './dto/verify-telegram-code.dto.js';
import { TelegramBotService } from './telegram-bot.service.js';
import { JwtAuthGuard, type AuthedRequest } from './jwt-auth.guard.js';

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest) {
    return this.authService.getMe(req.user!.sub);
  }
}
