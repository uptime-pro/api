import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MaintenanceService as MaintenanceWindowService } from '../maintenance/maintenance.service.js';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly maintenanceWindowService: MaintenanceWindowService,
  ) {}

  async isInMaintenance(monitorId: number): Promise<boolean> {
    const now = new Date();
    const links = await this.prisma.maintenanceMonitor.findMany({
      where: { monitorId },
      include: { maintenance: true },
    });
    for (const link of links) {
      const mw = link.maintenance;
      if (this.maintenanceWindowService.isWindowActive(mw, now)) return true;
    }
    return false;
  }
}
