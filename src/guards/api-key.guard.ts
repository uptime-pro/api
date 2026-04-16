import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from '../decorators/current-user.decorator.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }
    const rawKey = authHeader.slice(7);

    const apiKeys = await this.prisma.apiKey.findMany({
      where: { active: true },
      include: { user: true },
    });

    for (const apiKey of apiKeys) {
      if (apiKey.expires && apiKey.expires < new Date()) continue;
      const match = await bcrypt.compare(rawKey, apiKey.key);
      if (match) {
        req.user = {
          sub: apiKey.user.id,
          username: apiKey.user.username,
          role: apiKey.user.role,
        };
        req['apiKeyPermission'] = apiKey.permission;
        return true;
      }
    }
    throw new UnauthorizedException('Invalid API key');
  }
}
