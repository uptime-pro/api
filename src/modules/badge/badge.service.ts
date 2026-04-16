import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

function generateBadge(label: string, message: string, color: string): string {
  const labelWidth = label.length * 6 + 10;
  const messageWidth = message.length * 6 + 10;
  const totalWidth = labelWidth + messageWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <rect rx="3" width="${totalWidth}" height="20" fill="#555"/>
  <rect rx="3" x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
  <rect rx="3" width="${totalWidth}" height="20" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + messageWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${message}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
  </g>
</svg>`;
}

@Injectable()
export class BadgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatusBadge(id: number): Promise<string> {
    const monitor = await this.prisma.monitor.findUnique({ where: { id } });

    if (!monitor) {
      return generateBadge('status', 'unknown', '#9f9f9f');
    }

    if (monitor.lastStatus === true) {
      return generateBadge('status', 'up', '#4c1');
    } else if (monitor.lastStatus === false) {
      return generateBadge('status', 'down', '#e05d44');
    } else {
      return generateBadge('status', 'pending', '#9f9f9f');
    }
  }

  async getUptimeBadge(id: number): Promise<string> {
    const monitor = await this.prisma.monitor.findUnique({ where: { id } });
    if (!monitor) {
      return generateBadge('uptime', 'unknown', '#9f9f9f');
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [total, up] = await Promise.all([
      this.prisma.heartbeat.count({ where: { monitorId: id, createdAt: { gte: since } } }),
      this.prisma.heartbeat.count({ where: { monitorId: id, createdAt: { gte: since }, status: true } }),
    ]);

    if (total === 0) {
      return generateBadge('uptime', 'no data', '#9f9f9f');
    }

    const pct = (up / total) * 100;
    const label = `${pct.toFixed(1)}%`;
    const color = pct >= 99 ? '#4c1' : pct >= 95 ? '#dfb317' : '#e05d44';

    return generateBadge('uptime', label, color);
  }
}
