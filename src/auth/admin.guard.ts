import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isAdminRole } from '../users/user-role.js';
import type { AuthedRequest } from './jwt-auth.guard.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (!isAdminRole(request.user?.role)) {
      throw new ForbiddenException('Admin');
    }
    return true;
  }
}
