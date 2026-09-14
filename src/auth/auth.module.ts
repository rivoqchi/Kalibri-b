import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthCode, AuthCodeSchema } from './auth-code.schema.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { TelegramBotService } from './telegram-bot.service.js';
import { JwtTokenService } from './jwt-token.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: AuthCode.name, schema: AuthCodeSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TelegramBotService,
    JwtTokenService,
    JwtAuthGuard,
    AdminGuard,
  ],
  exports: [AuthService, JwtTokenService, JwtAuthGuard, AdminGuard],
})
export class AuthModule {}
