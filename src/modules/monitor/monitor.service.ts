import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MONITOR_QUEUE } from '../../queue/queue.module.js';
import { MonitorStrategyRegistry } from './strategies/strategy.registry.js';
import type { CheckResult } from './strategies/monitor-strategy.interface.js';
import type { CreateMonitorDto } from './dto/create-monitor.dto.js';
import type { UpdateMonitorDto } from './dto/update-monitor.dto.js';
import type { HeartbeatQueryDto } from './dto/heartbeat-query.dto.js';
import type { MonitorExportDto, MonitorExportItemDto } from './dto/monitor-export.dto.js';
import type { MonitorImportDto, MonitorImportResultDto } from './dto/monitor-import.dto.js';
import crypto from 'node:crypto';

@Injectable()
export class MonitorService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MONITOR_QUEUE) private readonly queue: Queue,
    private readonly registry: MonitorStrategyRegistry,
  ) {}

  async findAll(userId: number, role?: string) {
    const where = role === 'ADMIN' ? {} : { userId };
    return this.prisma.monitor.findMany({ where, orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: number, userId: number, role?: string) {
    const monitor = await this.prisma.monitor.findUnique({ where: { id } });
    if (!monitor) throw new NotFoundException(`Monitor #${id} not found`);
    if (role !== 'ADMIN' && monitor.userId !== userId) throw new ForbiddenException();
    return monitor;
  }

  async create(userId: number, dto: CreateMonitorDto) {
    this.registry.getStrategy(dto.type);
    const config = { ...dto.config };
    if (dto.type === 'push') {
      config['pushToken'] = crypto.randomBytes(32).toString('hex');
    }
    const monitor = await this.prisma.monitor.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        active: dto.active ?? true,
        interval: dto.interval ?? 60,
        retryInterval: dto.retryInterval ?? 60,
        maxRetries: dto.maxRetries ?? 1,
        notificationDelay: dto.notificationDelay ?? 0,
        resendInterval: dto.resendInterval ?? 0,
        upsideDown: dto.upsideDown ?? false,
        config: config as never,
        slaTarget: dto.slaTarget ?? null,
        responseTimeThreshold: dto.responseTimeThreshold ?? null,
      },
    });
    if (monitor.active && monitor.type !== 'push') {
      await this.scheduleJob(monitor.id, monitor.interval);
    }
    return monitor;
  }

  async update(id: number, userId: number, dto: UpdateMonitorDto, role?: string) {
    await this.findOne(id, userId, role);
    const updated = await this.prisma.monitor.update({ where: { id }, data: dto as never });
    if (dto.interval !== undefined || dto.active !== undefined) {
      await this.removeJob(id);
      if (updated.active && updated.type !== 'push') {
        await this.scheduleJob(id, updated.interval);
      }
    }
    return updated;
  }

  async remove(id: number, userId: number, role?: string) {
    await this.findOne(id, userId, role);
    await this.removeJob(id);
    await this.prisma.monitor.delete({ where: { id } });
    return { message: `Monitor #${id} deleted` };
  }

  async pause(id: number, userId: number, role?: string) {
    await this.findOne(id, userId, role);
    await this.removeJob(id);
    const updated = await this.prisma.monitor.update({ where: { id }, data: { active: false } });
    return updated;
  }

  async resume(id: number, userId: number, role?: string) {
    const monitor = await this.findOne(id, userId, role);
    await this.prisma.monitor.update({ where: { id }, data: { active: true } });
    if (monitor.type !== 'push') {
      await this.scheduleJob(id, monitor.interval);
    }
    return { ...monitor, active: true };
  }

  async manualCheck(id: number, userId: number, role?: string) {
    await this.findOne(id, userId, role);
    await this.queue.add('check', { monitorId: id }, { jobId: `manual-${id}-${Date.now()}` });
    return { message: 'Check queued' };
  }

  async getHeartbeats(id: number, userId: number, query: HeartbeatQueryDto, role?: string) {
    await this.findOne(id, userId, role);
    const where: Record<string, unknown> = { monitorId: id };
    if (query.before) {
      where['createdAt'] = { lt: new Date(query.before) };
    }
    return this.prisma.heartbeat.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 100,
    });
  }

  async deleteHeartbeats(id: number, userId: number, role?: string) {
    await this.findOne(id, userId, role);
    await this.prisma.heartbeat.deleteMany({ where: { monitorId: id } });
    return { message: 'Heartbeats deleted' };
  }

  async writeHeartbeat(monitorId: number, result: CheckResult): Promise<{ changed: boolean; previousStatus: boolean | null }> {
    const monitor = await this.prisma.monitor.findUnique({ where: { id: monitorId } });
    if (!monitor) throw new NotFoundException(`Monitor #${monitorId} not found`);
    const previousStatus = monitor.lastStatus;
    const changed = previousStatus !== result.status;
    await this.prisma.heartbeat.create({
      data: {
        monitorId,
        status: result.status,
        ping: result.ping,
        msg: result.message,
        important: changed,
      },
    });
    await this.prisma.monitor.update({
      where: { id: monitorId },
      data: { lastStatus: result.status, lastPing: result.ping },
    });
    return { changed, previousStatus };
  }

  async handlePushHeartbeat(token: string): Promise<{ message: string }> {
    const monitors = await this.prisma.monitor.findMany({
      where: { type: 'push' },
    });
    const monitor = monitors.find((m) => {
      const cfg = m.config as Record<string, unknown>;
      return cfg['pushToken'] === token;
    });
    if (!monitor) throw new NotFoundException('Push token not found');
    await this.writeHeartbeat(monitor.id, { status: true, ping: 0, message: 'Push heartbeat received' });
    return { message: 'Heartbeat recorded' };
  }

  async exportMonitors(userId: number): Promise<MonitorExportDto> {
    const monitors = await this.prisma.monitor.findMany({
      where: { userId },
      include: { tags: { include: { tag: true } } },
    });
    const items: MonitorExportItemDto[] = monitors.map((m) => {
      const config = { ...(m.config as Record<string, unknown>) };
      delete config['password'];
      delete config['authPassword'];
      return {
        name: m.name,
        type: m.type,
        active: m.active,
        interval: m.interval,
        retryInterval: m.retryInterval,
        maxRetries: m.maxRetries,
        notificationDelay: m.notificationDelay,
        resendInterval: m.resendInterval,
        upsideDown: m.upsideDown,
        config,
        ...(m.slaTarget !== null && m.slaTarget !== undefined ? { slaTarget: m.slaTarget } : {}),
        ...(m.responseTimeThreshold !== null && m.responseTimeThreshold !== undefined ? { responseTimeThreshold: m.responseTimeThreshold } : {}),
        tags: m.tags.map((mt) => mt.tag.name),
      };
    });
    return { version: '1', exportedAt: new Date().toISOString(), monitors: items };
  }

  async importMonitors(userId: number, dto: MonitorImportDto): Promise<MonitorImportResultDto> {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;
    for (const item of dto.monitors) {
      try {
        this.registry.getStrategy(item.type);
        const config = { ...item.config };
        if (item.type === 'push') {
          config['pushToken'] = crypto.randomBytes(32).toString('hex');
        }
        const monitor = await this.prisma.monitor.create({
          data: {
            userId,
            name: item.name,
            type: item.type,
            active: item.active ?? true,
            interval: item.interval ?? 60,
            retryInterval: item.retryInterval ?? 60,
            maxRetries: item.maxRetries ?? 1,
            notificationDelay: item.notificationDelay ?? 0,
            resendInterval: item.resendInterval ?? 0,
            upsideDown: item.upsideDown ?? false,
            config: config as never,
            slaTarget: item.slaTarget ?? null,
            responseTimeThreshold: item.responseTimeThreshold ?? null,
          },
        });
        if (monitor.active && monitor.type !== 'push') {
          await this.scheduleJob(monitor.id, monitor.interval);
        }
        imported++;
      } catch (err) {
        errors.push(`Failed to import "${item.name}": ${err instanceof Error ? err.message : String(err)}`);
        skipped++;
      }
    }
    return { imported, skipped, errors };
  }

  async getSlaStats(monitorId: number, userId: number, days = 30, role?: string) {
    const monitor = await this.findOne(monitorId, userId, role);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const heartbeats = await this.prisma.heartbeat.findMany({
      where: { monitorId, createdAt: { gte: since } },
      select: { status: true },
    });
    const total = heartbeats.length;
    const up = heartbeats.filter((h) => h.status).length;
    return {
      slaTarget: monitor.slaTarget ?? null,
      uptimePercent: total > 0 ? Math.round((up / total) * 10000) / 100 : 100,
      totalChecks: total,
      upChecks: up,
    };
  }

  private async scheduleJob(monitorId: number, interval: number): Promise<void> {
    await this.queue.add(
      'check',
      { monitorId },
      {
        jobId: `monitor-${monitorId}`,
        repeat: { every: interval * 1000 },
      },
    );
  }

  private async removeJob(monitorId: number): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const job = repeatableJobs.find((j) => j.id === `monitor-${monitorId}`);
    if (job) {
      await this.queue.removeRepeatableByKey(job.key);
    }
  }
}
