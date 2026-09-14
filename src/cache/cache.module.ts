import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  private redis: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('redisUrl');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      void this.redis.connect().catch((error: unknown) => {
        this.logger.warn(`Redis unavailable, using memory cache: ${String(error)}`);
        void this.redis?.quit();
        this.redis = null;
      });
    } else {
      this.logger.warn('REDIS_URL not set — using in-memory cache (dev only)');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }

    const hit = this.memory.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.memory.delete(key);
      return null;
    }
    return JSON.parse(hit.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    const raw = JSON.stringify(value);
    if (this.redis) {
      await this.redis.set(key, raw, 'EX', ttlSeconds);
      return;
    }
    this.memory.set(key, {
      value: raw,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(key);
      return;
    }
    this.memory.delete(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    if (this.redis) {
      const stream = this.redis.scanStream({ match: `${prefix}*`, count: 100 });
      const pipeline = this.redis.pipeline();
      for await (const keys of stream) {
        for (const key of keys as string[]) {
          pipeline.del(key);
        }
      }
      await pipeline.exec();
      return;
    }

    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
  }

  getRedisClient(): Redis | null {
    return this.redis;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
