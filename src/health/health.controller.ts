import { Body, Controller, Get, Post } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { TelegramBotService } from '../auth/telegram-bot.service.js';
import { CacheService } from '../cache/cache.module.js';
import { agentDebugLog } from '../common/utils/agent-debug-log.js';

@Controller('api/health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
    private readonly cache: CacheService,
    private readonly telegramBot: TelegramBotService,
  ) {}

  @Get()
  async check() {
    const mongoOk = this.connection.readyState === 1;
    const redisOk = Boolean(this.cache.getRedisClient()?.status === 'ready');
    const telegramReady = this.telegramBot.isReady();

    return {
      status: mongoOk && telegramReady ? 'ok' : 'degraded',
      mongo: mongoOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'memory-fallback',
      telegram: telegramReady ? 'up' : 'down',
      telegramBot: this.telegramBot.getBotUsername(),
      timestamp: new Date().toISOString(),
    };
  }

  /** Temporary client→file debug bridge (session 51bb44). */
  @Post('client-log')
  clientLog(
    @Body()
    body: {
      hypothesisId?: string;
      location?: string;
      message?: string;
      data?: Record<string, unknown>;
      runId?: string;
    },
  ) {
    // #region agent log
    agentDebugLog({
      hypothesisId: body?.hypothesisId ?? 'UI',
      location: body?.location ?? 'client',
      message: body?.message ?? 'client-log',
      data: body?.data ?? {},
      runId: body?.runId ?? 'post-fix',
    });
    // #endregion
    return { ok: true };
  }
}
