import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from '../decorators/current-user.decorator.js';

@Injectable()
export class AdminQueueMiddleware implements NestMiddleware {
  constructor(private readonly jwt: JwtService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const token =
      req.cookies?.['access_token'] ??
      (req.headers['authorization']?.startsWith('Bearer ')
        ? req.headers['authorization'].slice(7)
        : undefined);

    if (!token) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      if (payload.role !== 'ADMIN') {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }
      next();
    } catch {
      res.status(401).json({ message: 'Invalid or expired token' });
    }
  }
}
