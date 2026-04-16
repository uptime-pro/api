import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateStatusPageDto } from './dto/create-status-page.dto.js';
import type { UpdateStatusPageDto } from './dto/update-status-page.dto.js';
import type { SetStatusPageMonitorsDto } from './dto/set-monitors.dto.js';

@Injectable()
export class StatusPageService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number, role?: string) {
    const where = role === 'ADMIN' ? {} : { userId };
    return this.prisma.statusPage.findMany({ where, orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: number, userId: number, role?: string) {
    const page = await this.prisma.statusPage.findUnique({
      where: { id },
      include: { monitors: { include: { monitor: true } } },
    });
    if (!page) throw new NotFoundException(`StatusPage #${id} not found`);
    if (role !== 'ADMIN' && page.userId !== userId) throw new ForbiddenException();
    return page;
  }

  async create(userId: number, dto: CreateStatusPageDto) {
    const existing = await this.prisma.statusPage.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" is already taken`);
    return this.prisma.statusPage.create({
      data: {
        userId,
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        theme: dto.theme ?? 'auto',
        published: dto.published ?? false,
        customDomain: dto.customDomain,
        customCss: dto.customCss,
        footerText: dto.footerText,
      },
    });
  }

  async update(id: number, userId: number, dto: UpdateStatusPageDto, role?: string) {
    const page = await this.prisma.statusPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException(`StatusPage #${id} not found`);
    if (role !== 'ADMIN' && page.userId !== userId) throw new ForbiddenException();

    if (dto.slug && dto.slug !== page.slug) {
      const conflict = await this.prisma.statusPage.findUnique({ where: { slug: dto.slug } });
      if (conflict) throw new ConflictException(`Slug "${dto.slug}" is already taken`);
    }

    return this.prisma.statusPage.update({ where: { id }, data: dto as never });
  }

  async remove(id: number, userId: number, role?: string) {
    const page = await this.prisma.statusPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException(`StatusPage #${id} not found`);
    if (role !== 'ADMIN' && page.userId !== userId) throw new ForbiddenException();
    await this.prisma.statusPage.delete({ where: { id } });
    return { message: `StatusPage #${id} deleted` };
  }

  async setMonitors(id: number, userId: number, dto: SetStatusPageMonitorsDto, role?: string) {
    const page = await this.prisma.statusPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException(`StatusPage #${id} not found`);
    if (role !== 'ADMIN' && page.userId !== userId) throw new ForbiddenException();

    if (dto.monitors.length > 0) {
      const monitorIds = dto.monitors.map((m) => m.monitorId);
      const monitors = await this.prisma.monitor.findMany({
        where: { id: { in: monitorIds } },
      });
      if (monitors.length !== monitorIds.length) {
        throw new BadRequestException('One or more monitor IDs are invalid');
      }
      if (role !== 'ADMIN') {
        const unauthorized = monitors.filter((m) => m.userId !== userId);
        if (unauthorized.length > 0) {
          throw new ForbiddenException('You do not own all referenced monitors');
        }
      }
    }

    await this.prisma.$transaction([
      this.prisma.statusPageMonitor.deleteMany({ where: { statusPageId: id } }),
      ...dto.monitors.map((m) =>
        this.prisma.statusPageMonitor.create({
          data: {
            statusPageId: id,
            monitorId: m.monitorId,
            groupName: m.groupName,
            ordering: m.ordering ?? 0,
          },
        }),
      ),
    ]);

    return this.prisma.statusPageMonitor.findMany({
      where: { statusPageId: id },
      include: { monitor: true },
      orderBy: { ordering: 'asc' },
    });
  }

  async getMonitors(id: number, userId: number, role?: string) {
    const page = await this.prisma.statusPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException(`StatusPage #${id} not found`);
    if (role !== 'ADMIN' && page.userId !== userId) throw new ForbiddenException();

    return this.prisma.statusPageMonitor.findMany({
      where: { statusPageId: id },
      include: { monitor: true },
      orderBy: { ordering: 'asc' },
    });
  }

  async getPublicStatusPage(slug: string) {
    return this._buildPublicData({ slug, published: true });
  }

  async getPublicStatusPageByDomain(domain: string) {
    return this._buildPublicData({ customDomain: domain, published: true });
  }

  private async _buildPublicData(where: Record<string, unknown>) {
    const page = await this.prisma.statusPage.findFirst({
      where: where as never,
      include: {
        monitors: {
          include: { monitor: true },
          orderBy: { ordering: 'asc' },
        },
        incidents: {
          where: { status: { not: 'RESOLVED' } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { updates: { orderBy: { createdAt: 'desc' } } },
        },
      },
    });

    if (!page) return null;

    const monitorIds = page.monitors.map((m) => m.monitorId);

    const maintenanceWindows = monitorIds.length
      ? await this.prisma.maintenanceWindow.findMany({
          where: {
            active: true,
            monitors: { some: { monitorId: { in: monitorIds } } },
          },
        })
      : [];

    // Build 90-day daily uptime history for each monitor
    const days = 90;
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const allHeartbeats = monitorIds.length
      ? await this.prisma.heartbeat.findMany({
          where: { monitorId: { in: monitorIds }, createdAt: { gte: since } },
          select: { monitorId: true, status: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    // Group heartbeats by monitorId → day bucket
    const uptimeByMonitor = new Map<number, { date: string; up: number; total: number }[]>();
    for (const id of monitorIds) {
      const buckets: Map<string, { up: number; total: number }> = new Map();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        buckets.set(key, { up: 0, total: 0 });
      }
      for (const hb of allHeartbeats) {
        if (hb.monitorId !== id) continue;
        const key = hb.createdAt.toISOString().slice(0, 10);
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.total++;
          if (hb.status) bucket.up++;
        }
      }
      uptimeByMonitor.set(
        id,
        Array.from(buckets.entries()).map(([date, v]) => ({ date, ...v })),
      );
    }

    // 30-day overall uptime % per monitor
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentHeartbeats = allHeartbeats.filter((h) => h.createdAt >= thirtyDaysAgo);
    const uptimePctByMonitor = new Map<number, number>();
    for (const id of monitorIds) {
      const hbs = recentHeartbeats.filter((h) => h.monitorId === id);
      const pct = hbs.length > 0 ? Math.round((hbs.filter((h) => h.status).length / hbs.length) * 10000) / 100 : 100;
      uptimePctByMonitor.set(id, pct);
    }

    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      description: page.description,
      published: page.published,
      theme: page.theme,
      customCss: page.customCss,
      footerText: page.footerText,
      showTags: page.showTags,
      googleAnalytics: page.googleAnalytics,
      monitors: page.monitors.map((m) => ({
        id: m.monitor.id,
        name: m.monitor.name,
        type: m.monitor.type,
        groupName: m.groupName,
        ordering: m.ordering,
        lastStatus:
          m.monitor.lastStatus === true
            ? 'up'
            : m.monitor.lastStatus === false
              ? 'down'
              : 'pending',
        lastPing: m.monitor.lastPing,
        uptimePct: uptimePctByMonitor.get(m.monitor.id) ?? 100,
        history: uptimeByMonitor.get(m.monitor.id) ?? [],
      })),
      incidents: page.incidents.map((inc) => ({
        id: inc.id,
        title: inc.title,
        message: inc.content,
        severity: inc.severity,
        status: inc.status,
        createdAt: inc.createdAt,
        updates: inc.updates.map((u) => ({
          id: u.id,
          message: u.content,
          status: u.status,
          createdAt: u.createdAt,
        })),
      })),
      maintenanceWindows: maintenanceWindows.map((mw) => ({
        id: mw.id,
        name: mw.title,
        startTime: mw.startDate,
        endTime: mw.endDate,
      })),
    };
  }
}
