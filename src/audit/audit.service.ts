import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: {
    userId?: number;
    action: string;
    entity?: string;
    entityId?: number;
    meta?: Record<string, unknown>;
    ip?: string;
  }): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action: entry.action,
      userId: entry.userId,
      entity: entry.entity,
      entityId: entry.entityId,
      meta: entry.meta as Prisma.InputJsonValue | undefined,
      ip: entry.ip,
    };
    await this.prisma.auditLog.create({ data }).catch(() => {});
  }
}
