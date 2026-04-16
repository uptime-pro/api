import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class GroupStrategy implements MonitorStrategy {
  constructor(private readonly prisma: PrismaService) {}

  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const childIds = config['childMonitorIds'] as number[] | undefined;
    if (!childIds || childIds.length === 0) {
      return { status: true, ping: 0, message: 'Group monitor: no children configured' };
    }
    const monitors = await this.prisma.monitor.findMany({
      where: { id: { in: childIds } },
      select: { id: true, name: true, lastStatus: true },
    });
    const allUp = monitors.every((m) => m.lastStatus !== false);
    const downCount = monitors.filter((m) => m.lastStatus === false).length;
    return {
      status: allUp,
      ping: 0,
      message: downCount === 0 ? 'All children up' : `${downCount}/${monitors.length} children down`,
    };
  }
}
