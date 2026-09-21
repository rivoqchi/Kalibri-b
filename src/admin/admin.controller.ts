import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SuperAdminGuard } from '../auth/super-admin.guard.js';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  @Get()
  panel() {
    return { ok: true };
  }
}
