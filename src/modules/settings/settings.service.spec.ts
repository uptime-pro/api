import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';

const mockPrisma = {
  setting: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('returns defaults when DB is empty', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([]);
      const result = await service.getSettings();
      expect(result.siteName).toBe('Uptime Pro');
      expect(result.checkIntervalSeconds).toBe(60);
      expect(result.retryCount).toBe(3);
      expect(result.timezone).toBe('UTC');
    });

    it('merges stored values over defaults', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'general.siteName', value: 'My Uptime' },
        { key: 'general.checkIntervalSeconds', value: '120' },
      ]);
      const result = await service.getSettings();
      expect(result.siteName).toBe('My Uptime');
      expect(result.checkIntervalSeconds).toBe(120); // coerced to number
      expect(result.retryCount).toBe(3); // still default
    });

    it('coerces numeric settings from string', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'notification.retryCount', value: '5' },
      ]);
      const result = await service.getSettings();
      expect(typeof result.retryCount).toBe('number');
      expect(result.retryCount).toBe(5);
    });
  });

  describe('updateSettings', () => {
    it('upserts only provided keys', async () => {
      mockPrisma.setting.upsert.mockResolvedValue({});
      mockPrisma.setting.findMany.mockResolvedValue([]);

      await service.updateSettings({ siteName: 'New Name' }, 1, '127.0.0.1');

      expect(mockPrisma.setting.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'general.siteName' },
          create: expect.objectContaining({ value: 'New Name' }),
          update: expect.objectContaining({ value: 'New Name' }),
        }),
      );
    });

    it('calls audit log after update', async () => {
      mockPrisma.setting.upsert.mockResolvedValue({});
      mockPrisma.setting.findMany.mockResolvedValue([]);

      await service.updateSettings({ timezone: 'America/New_York' }, 1, '10.0.0.1');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, action: 'settings.update', ip: '10.0.0.1' }),
      );
    });

    it('skips undefined fields', async () => {
      mockPrisma.setting.upsert.mockResolvedValue({});
      mockPrisma.setting.findMany.mockResolvedValue([]);

      await service.updateSettings({}, 1);
      expect(mockPrisma.setting.upsert).not.toHaveBeenCalled();
    });

    it('returns updated settings', async () => {
      mockPrisma.setting.upsert.mockResolvedValue({});
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'general.siteName', value: 'Updated' },
      ]);

      const result = await service.updateSettings({ siteName: 'Updated' }, 1);
      expect(result.siteName).toBe('Updated');
    });
  });
});
