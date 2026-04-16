import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class ApiKeyScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { apiKeyPermission?: string }>();
    if (req['apiKeyPermission'] !== undefined && req['apiKeyPermission'] !== 'read-write') {
      throw new ForbiddenException('API key requires read-write permission');
    }
    return true;
  }
}
