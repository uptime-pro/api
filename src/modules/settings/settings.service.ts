import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import type { SettingsResponseDto } from './dto/settings-response.dto.js';

const DEFAULTS: SettingsResponseDto = {
  siteName: 'Uptime Pro',
  checkIntervalSeconds: 60,
  defaultResendIntervalMinutes: 60,
  retryCount: 3,
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD',
};

const KEY_MAP: Record<keyof SettingsResponseDto, string> = {
  siteName: 'general.siteName',
  checkIntervalSeconds: 'general.checkIntervalSeconds',
  defaultResendIntervalMinutes: 'notification.defaultResendIntervalMinutes',
  retryCount: 'notification.retryCount',
  timezone: 'display.timezone',
  dateFormat: 'display.dateFormat',
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getSettings(): Promise<SettingsResponseDto> {
    const keys = Object.values(KEY_MAP);
    const rows = await this.prisma.setting.findMany({ where: { key: { in: keys } } });
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const result = { ...DEFAULTS };
    for (const [field, dbKey] of Object.entries(KEY_MAP) as [keyof SettingsResponseDto, string][]) {
      if (stored[dbKey] !== undefined) {
        const def = DEFAULTS[field];
        (result[field] as unknown) = typeof def === 'number' ? Number(stored[dbKey]) : stored[dbKey];
      }
    }
    return result;
  }

  async updateSettings(dto: UpdateSettingsDto, userId: number, ip?: string): Promise<SettingsResponseDto> {
    const changedKeys: string[] = [];

    for (const [field, value] of Object.entries(dto) as [keyof UpdateSettingsDto, unknown][]) {
      if (value === undefined) continue;
      const dbKey = KEY_MAP[field as keyof SettingsResponseDto];
      if (!dbKey) continue;
      await this.prisma.setting.upsert({
        where: { key: dbKey },
        create: { key: dbKey, value: String(value) },
        update: { value: String(value) },
      });
      changedKeys.push(field);
    }

    await this.audit.log({
      userId,
      action: 'settings.update',
      entity: 'Setting',
      meta: { changedKeys },
      ip,
    });

    return this.getSettings();
  }
}
