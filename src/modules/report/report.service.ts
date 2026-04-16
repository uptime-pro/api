import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import type { ReportConfigDto } from './dto/report-config.dto.js';
import type { UpdateReportConfigDto } from './dto/update-report-config.dto.js';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async getReportConfig(): Promise<ReportConfigDto> {
    const keys = ['report.enabled', 'report.recipientEmail', 'report.frequency'];
    const rows = await this.prisma.setting.findMany({ where: { key: { in: keys } } });
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return {
      enabled: stored['report.enabled'] === 'true',
      recipientEmail: stored['report.recipientEmail'] ?? '',
      frequency: (stored['report.frequency'] as 'daily' | 'weekly' | 'monthly') ?? 'weekly',
    };
  }

  async updateReportConfig(dto: UpdateReportConfigDto, userId: number, ip?: string): Promise<ReportConfigDto> {
    const updates: Array<{ key: string; value: string }> = [];

    if (dto.enabled !== undefined) updates.push({ key: 'report.enabled', value: String(dto.enabled) });
    if (dto.recipientEmail !== undefined) updates.push({ key: 'report.recipientEmail', value: dto.recipientEmail });
    if (dto.frequency !== undefined) updates.push({ key: 'report.frequency', value: dto.frequency });

    for (const { key, value } of updates) {
      await this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    }

    await this.audit.log({ userId, action: 'report.config.update', entity: 'Setting', ip });

    return this.getReportConfig();
  }

  async sendUptimeReport(): Promise<void> {
    const cfg = await this.getReportConfig();
    if (!cfg.enabled || !cfg.recipientEmail) {
      this.logger.debug('Reports disabled or no recipient configured');
      return;
    }

    const days = cfg.frequency === 'daily' ? 1 : cfg.frequency === 'weekly' ? 7 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const monitors = await this.prisma.monitor.findMany({ where: { active: true }, orderBy: { name: 'asc' } });

    const lines: string[] = [`Monitor Summary (last ${days} day${days > 1 ? 's' : ''}):`];

    for (const monitor of monitors) {
      const [total, up] = await Promise.all([
        this.prisma.heartbeat.count({ where: { monitorId: monitor.id, createdAt: { gte: since } } }),
        this.prisma.heartbeat.count({ where: { monitorId: monitor.id, createdAt: { gte: since }, status: true } }),
      ]);

      if (total === 0) {
        lines.push(`- ${monitor.name}: no data`);
      } else {
        const pct = ((up / total) * 100).toFixed(2);
        lines.push(`- ${monitor.name}: ${pct}% uptime (${up}/${total} checks)`);
      }
    }

    const subject = `Uptime Pro — ${cfg.frequency.charAt(0).toUpperCase() + cfg.frequency.slice(1)} Uptime Report`;
    const text = lines.join('\n');

    await this.sendEmail(cfg.recipientEmail, subject, text);
  }

  private async sendEmail(to: string, subject: string, text: string): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT', 587);
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM', 'noreply@example.com');

    if (!host) {
      this.logger.warn('SMTP_HOST not configured — skipping report email');
      return;
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    await transporter.sendMail({ from, to, subject, text });
    this.logger.log(`Report email sent to ${to}`);
  }

  @Cron('0 8 * * *')
  async runDailySchedule(): Promise<void> {
    const cfg = await this.getReportConfig();
    if (!cfg.enabled) return;

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon
    const dayOfMonth = today.getDate();

    if (cfg.frequency === 'daily') {
      await this.sendUptimeReport();
    } else if (cfg.frequency === 'weekly' && dayOfWeek === 1) {
      await this.sendUptimeReport();
    } else if (cfg.frequency === 'monthly' && dayOfMonth === 1) {
      await this.sendUptimeReport();
    }
  }
}
