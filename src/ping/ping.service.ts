import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class PingService {
  private readonly logger = new Logger(PingService.name);
  private readonly enabled: boolean;
  private readonly url: string;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('ping.enabled') === true;
    this.url = this.config.getOrThrow<string>('ping.url');
  }

  @Cron(process.env.PING_CRON?.trim() || '*/10 * * * *')
  async selfPing(): Promise<void> {
    if (!this.enabled) return;

    try {
      const res = await fetch(this.url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`self-ping HTTP ${res.status}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`self-ping failed: ${message}`);
    }
  }
}
