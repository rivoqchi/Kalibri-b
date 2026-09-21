import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthedRequest } from './jwt-auth.guard.js';
import { JwtTokenService } from './jwt-token.service.js';
import { UsersService } from '../users/users.service.js';

/** Soft auth: attaches `request.user` when Bearer is valid; never blocks guests. */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return true;

    const token = header.slice('Bearer '.length).trim();
    if (!token) return true;

    try {
      const payload = await this.jwtTokenService.verify(token);
      const user =
        (await this.usersService.findById(payload.sub)) ??
        (await this.usersService.findByTelegramId(payload.telegramId));
      if (user?.isBlocked) return true;
      request.user = payload;
    } catch {
      // Guest continues without user.
    }
    return true;
  }
}
