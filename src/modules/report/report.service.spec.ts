import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReportService } from './report.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';

// Mock nodemailer before imports are resolved
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

import * as nodemailer from 'nodemailer';

const mockPrisma = {
  setting: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  monitor: {
    findMany: jest.fn(),
  },
  heartbeat: {
    count: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, def?: unknown) => {
    if (key === 'SMTP_HOST') return 'smtp.example.com';
    if (key === 'SMTP_PORT') return 587;
    if (key === 'SMTP_FROM') return 'noreply@example.com';
    return def;
  }),
};

describe('ReportService', () => {
  let service: ReportService;
  let mockTransporter: { sendMail: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    jest.clearAllMocks();

    mockTransporter = { sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }) };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    mockConfig.get.mockImplementation((key: string, def?: unknown) => {
      if (key === 'SMTP_HOST') return 'smtp.example.com';
      if (key === 'SMTP_PORT') return 587;
      if (key === 'SMTP_FROM') return 'noreply@example.com';
      return def;
    });
  });

  describe('getReportConfig', () => {
    it('returns defaults when DB is empty', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([]);
      const result = await service.getReportConfig();
      expect(result.enabled).toBe(false);
      expect(result.recipientEmail).toBe('');
      expect(result.frequency).toBe('weekly');
    });

    it('returns stored values', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'report.enabled', value: 'true' },
        { key: 'report.recipientEmail', value: 'admin@example.com' },
        { key: 'report.frequency', value: 'daily' },
      ]);
      const result = await service.getReportConfig();
      expect(result.enabled).toBe(true);
      expect(result.recipientEmail).toBe('admin@example.com');
      expect(result.frequency).toBe('daily');
    });
  });

  describe('updateReportConfig', () => {
    it('upserts all provided settings', async () => {
      mockPrisma.setting.upsert.mockResolvedValue({});
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'report.enabled', value: 'true' },
        { key: 'report.recipientEmail', value: 'admin@example.com' },
        { key: 'report.frequency', value: 'weekly' },
      ]);

      const result = await service.updateReportConfig(
        { enabled: true, recipientEmail: 'admin@example.com', frequency: 'weekly' },
        1,
        '127.0.0.1',
      );

      expect(mockPrisma.setting.upsert).toHaveBeenCalledTimes(3);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, action: 'report.config.update' }),
      );
      expect(result.enabled).toBe(true);
    });

    it('skips undefined fields', async () => {
      mockPrisma.setting.upsert.mockResolvedValue({});
      mockPrisma.setting.findMany.mockResolvedValue([]);

      await service.updateReportConfig({ enabled: true }, 1);
      expect(mockPrisma.setting.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendUptimeReport', () => {
    it('sends report email with monitor summary', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'report.enabled', value: 'true' },
        { key: 'report.recipientEmail', value: 'admin@example.com' },
        { key: 'report.frequency', value: 'weekly' },
      ]);
      mockPrisma.monitor.findMany.mockResolvedValue([
        { id: 1, name: 'Website', active: true },
      ]);
      mockPrisma.heartbeat.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(99);  // up

      await service.sendUptimeReport();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.example.com' }),
      );
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          subject: expect.stringContaining('Uptime'),
          text: expect.stringContaining('Website'),
        }),
      );
    });

    it('skips sending when reports are disabled', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'report.enabled', value: 'false' },
      ]);

      await service.sendUptimeReport();
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('skips sending when no recipient email configured', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'report.enabled', value: 'true' },
        { key: 'report.recipientEmail', value: '' },
      ]);

      await service.sendUptimeReport();
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('shows "no data" for monitors with zero heartbeats', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'report.enabled', value: 'true' },
        { key: 'report.recipientEmail', value: 'admin@example.com' },
        { key: 'report.frequency', value: 'weekly' },
      ]);
      mockPrisma.monitor.findMany.mockResolvedValue([{ id: 1, name: 'Empty Monitor', active: true }]);
      mockPrisma.heartbeat.count.mockResolvedValue(0);

      await service.sendUptimeReport();

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining('no data') }),
      );
    });

    it('skips email when SMTP_HOST is not configured', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'report.enabled', value: 'true' },
        { key: 'report.recipientEmail', value: 'admin@example.com' },
        { key: 'report.frequency', value: 'weekly' },
      ]);
      mockPrisma.monitor.findMany.mockResolvedValue([]);
      mockConfig.get.mockImplementation((key: string, def?: unknown) => {
        if (key === 'SMTP_HOST') return undefined;
        return def;
      });

      await service.sendUptimeReport();
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });
  });
});
