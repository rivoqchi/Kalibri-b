import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { CacheService } from '../cache/cache.module.js';

@Controller('api/health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
    private readonly cache: CacheService,
  ) {}

  @Get()
  async check() {
    // #region agent log
    fetch('http://127.0.0.1:7580/ingest/34e913d6-8720-4f4c-8d69-15c2fc7de272', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'de3394',
      },
      body: JSON.stringify({
        sessionId: 'de3394',
        runId: 'post-fix',
        hypothesisId: 'A',
        location: 'health.controller.ts:check',
        message: 'health check executed after Connection import fix',
        data: {
          readyState: this.connection.readyState,
          redisStatus: this.cache.getRedisClient()?.status ?? 'memory-fallback',
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const mongoOk = this.connection.readyState === 1;
    const redisOk = Boolean(this.cache.getRedisClient()?.status === 'ready');

    return {
      status: mongoOk ? 'ok' : 'degraded',
      mongo: mongoOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'memory-fallback',
      timestamp: new Date().toISOString(),
    };
  }
}
