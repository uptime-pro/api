import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto.js';
import type { MaintenanceResponseDto } from './dto/maintenance-response.dto.js';

type MaintenanceWindow = {
  strategy: string;
  active: boolean;
  startDate: Date | null;
  endDate: Date | null;
  weekdays: number[];
  hours: number[];
  durationMinutes: number;
  cronExpr: string | null;
  timezone: string;
};

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toResponse(mw: MaintenanceWindow & { id: number; userId: number; title: string; createdAt: Date; updatedAt: Date; monitors: { monitorId: number }[] }): MaintenanceResponseDto {
    return {
      ...mw,
      monitorIds: mw.monitors.map((m) => m.monitorId),
    };
  }

  async findAll(userId: number): Promise<MaintenanceResponseDto[]> {
    const rows = await this.prisma.maintenanceWindow.findMany({
      where: { userId },
      include: { monitors: true },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async findOne(id: number, userId: number): Promise<MaintenanceResponseDto> {
    const mw = await this.prisma.maintenanceWindow.findUnique({
      where: { id },
      include: { monitors: true },
    });
    if (!mw) throw new NotFoundException(`Maintenance window ${id} not found`);
    if (mw.userId !== userId) throw new ForbiddenException('Access denied');
    return this.toResponse(mw);
  }

  async create(userId: number, dto: CreateMaintenanceDto, ip?: string): Promise<MaintenanceResponseDto> {
    const { monitorIds = [], startDate, endDate, ...rest } = dto;

    const mw = await this.prisma.maintenanceWindow.create({
      data: {
        ...rest,
        userId,
        active: rest.active ?? true,
        weekdays: rest.weekdays ?? [],
        hours: rest.hours ?? [],
        durationMinutes: rest.durationMinutes ?? 60,
        timezone: rest.timezone ?? 'UTC',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        monitors: {
          create: monitorIds.map((monitorId) => ({ monitorId })),
        },
      },
      include: { monitors: true },
    });

    await this.audit.log({ userId, action: 'maintenance.create', entity: 'MaintenanceWindow', entityId: mw.id, meta: { title: mw.title }, ip });
    return this.toResponse(mw);
  }

  async update(id: number, userId: number, dto: UpdateMaintenanceDto, ip?: string): Promise<MaintenanceResponseDto> {
    await this.findOne(id, userId);
    const { monitorIds, startDate, endDate, ...rest } = dto;

    const mw = await this.prisma.maintenanceWindow.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
        ...(monitorIds !== undefined
          ? {
              monitors: {
                deleteMany: {},
                create: monitorIds.map((monitorId) => ({ monitorId })),
              },
            }
          : {}),
      },
      include: { monitors: true },
    });

    await this.audit.log({ userId, action: 'maintenance.update', entity: 'MaintenanceWindow', entityId: id, meta: { ...rest }, ip });
    return this.toResponse(mw);
  }

  async delete(id: number, userId: number, ip?: string): Promise<void> {
    await this.findOne(id, userId);
    await this.prisma.maintenanceWindow.delete({ where: { id } });
    await this.audit.log({ userId, action: 'maintenance.delete', entity: 'MaintenanceWindow', entityId: id, ip });
  }

  async setMonitors(id: number, userId: number, monitorIds: number[], ip?: string): Promise<MaintenanceResponseDto> {
    await this.findOne(id, userId);
    await this.prisma.$transaction([
      this.prisma.maintenanceMonitor.deleteMany({ where: { maintenanceId: id } }),
      ...monitorIds.map((monitorId) =>
        this.prisma.maintenanceMonitor.create({ data: { maintenanceId: id, monitorId } }),
      ),
    ]);
    await this.audit.log({ userId, action: 'maintenance.setMonitors', entity: 'MaintenanceWindow', entityId: id, meta: { monitorIds }, ip });
    return this.findOne(id, userId);
  }

  isWindowActive(window: MaintenanceWindow, now: Date): boolean {
    if (!window.active) return false;

    switch (window.strategy) {
      case 'manual':
        return true;

      case 'one-time': {
        if (window.startDate && window.endDate) {
          return now >= window.startDate && now <= window.endDate;
        }
        if (window.startDate && !window.endDate) {
          return now >= window.startDate;
        }
        return false;
      }

      case 'recurring-interval':
      case 'recurring-weekday': {
        const dow = now.getDay();
        const hour = now.getHours();
        const weekdayMatch = window.weekdays.length === 0 || window.weekdays.includes(dow);
        const hourMatch = window.hours.length === 0 || window.hours.includes(hour);
        return weekdayMatch && hourMatch;
      }

      case 'recurring-day-of-month': {
        // weekdays field is repurposed as days-of-month (1-31)
        const dom = now.getDate();
        const hour = now.getHours();
        const domMatch = window.weekdays.length === 0 || window.weekdays.includes(dom);
        const hourMatch = window.hours.length === 0 || window.hours.includes(hour);
        return domMatch && hourMatch;
      }

      case 'cron': {
        if (!window.cronExpr) return false;
        try {
          const interval = CronExpressionParser.parse(window.cronExpr, {
            tz: window.timezone || 'UTC',
          });
          // Check if cron fired within the last durationMinutes
          const durationMs = (window.durationMinutes || 60) * 60 * 1000;
          const prev = interval.prev();
          return now.getTime() - prev.getTime() <= durationMs;
        } catch {
          return false;
        }
      }

      default:
        return false;
    }
  }
}
