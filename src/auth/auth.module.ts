import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthCode, AuthCodeSchema } from './auth-code.schema.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { TelegramBotService } from './telegram-bot.service.js';
import { TelegramPhotoService } from './telegram-photo.service.js';
import { JwtTokenService } from './jwt-token.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { SuperAdminGuard } from './super-admin.guard.js';
import { UsersModule } from '../users/users.module.js';
import { MediaModule } from '../media/media.module.js';
import { AUTH_BOT_API } from './auth-bot.api.js';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => MediaModule),
    MongooseModule.forFeature([
      { name: AuthCode.name, schema: AuthCodeSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_BOT_API, useExisting: AuthService },
    TelegramBotService,
    TelegramPhotoService,
    JwtTokenService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    AdminGuard,
    SuperAdminGuard,
  ],
  exports: [
    UsersModule,
    AuthService,
    TelegramBotService,
    JwtTokenService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    AdminGuard,
    SuperAdminGuard,
  ],
})
export class AuthModule {}
