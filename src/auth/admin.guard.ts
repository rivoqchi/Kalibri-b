import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthedRequest } from './jwt-auth.guard.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('Admin');
    }
    return true;
  }
}
