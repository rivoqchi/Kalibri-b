import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('api/ping')
export class PingController {
  @SkipThrottle()
  @Get()
  ping() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
