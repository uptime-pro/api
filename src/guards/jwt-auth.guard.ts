import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtPayload } from '../decorators/current-user.decorator.js';

@Injectable()
export class JwtAuthGuard {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const token: string | undefined = req.cookies?.['access_token'];
    if (!token) throw new UnauthorizedException('No session cookie');
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
