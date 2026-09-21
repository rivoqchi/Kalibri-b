import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtTokenService, type JwtPayload } from './jwt-token.service.js';
import { UsersService } from '../users/users.service.js';

export type AuthedRequest = Request & { user?: JwtPayload };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token kerak.');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Token kerak.');
    }
    let payload: JwtPayload;
    try {
      payload = await this.jwtTokenService.verify(token);
    } catch {
      throw new UnauthorizedException('Token yaroqsiz.');
    }

    const user =
      (await this.usersService.findById(payload.sub)) ??
      (await this.usersService.findByTelegramId(payload.telegramId));
    if (user?.isBlocked) {
      throw new ForbiddenException('Blok');
    }

    request.user = payload;
    return true;
  }
}
