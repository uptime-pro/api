import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { CheckResult, MonitorStrategy } from './monitor-strategy.interface.js';

@Injectable()
export class PushStrategy implements MonitorStrategy {
  constructor(private readonly prisma: PrismaService) {}

  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const monitorId = config['monitorId'] as number;
    const interval = (config['interval'] as number | undefined) ?? 120;

    const latest = await this.prisma.heartbeat.findFirst({
      where: { monitorId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return {
        status: false,
        ping: 0,
        message: 'No heartbeat received yet',
      };
    }

    const ageSeconds = (Date.now() - latest.createdAt.getTime()) / 1000;
    const threshold = interval * 2;

    if (ageSeconds > threshold) {
      return {
        status: false,
        ping: 0,
        message: `Last heartbeat was ${Math.round(ageSeconds)}s ago (threshold: ${threshold}s)`,
      };
    }

    return {
      status: true,
      ping: 0,
      message: `Heartbeat received ${Math.round(ageSeconds)}s ago`,
    };
  }
}
