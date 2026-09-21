import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthedRequest } from './jwt-auth.guard.js';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (!request.user) {
      throw new ForbiddenException('Admin panel');
    }
    const allowed = await this.authService.ensureSuperAdmin(request.user);
    if (!allowed) {
      throw new ForbiddenException('Admin panel');
    }
    return true;
  }
}
