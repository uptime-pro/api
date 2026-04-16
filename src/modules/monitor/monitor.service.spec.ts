import { Test, TestingModule } from '@nestjs/testing';
import { MonitorService } from './monitor.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MonitorStrategyRegistry } from './strategies/strategy.registry.js';
import { getQueueToken } from '@nestjs/bullmq';
import { MONITOR_QUEUE } from '../../queue/queue.module.js';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockQueue = {
  add: jest.fn(),
  getRepeatableJobs: jest.fn().mockResolvedValue([]),
  removeRepeatableByKey: jest.fn(),
};

const mockPrisma = {
  monitor: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  heartbeat: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
  },
};

const mockRegistry = {
  getStrategy: jest.fn().mockReturnValue({}),
};

describe('MonitorService', () => {
  let service: MonitorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(MONITOR_QUEUE), useValue: mockQueue },
        { provide: MonitorStrategyRegistry, useValue: mockRegistry },
      ],
    }).compile();

    service = module.get<MonitorService>(MonitorService);
  });

  describe('create', () => {
    it('creates monitor and schedules job for non-push type', async () => {
      const monitor = {
        id: 1,
        userId: 1,
        name: 'Test',
        type: 'http',
        active: true,
        interval: 60,
        retryInterval: 60,
        maxRetries: 1,
        notificationDelay: 0,
        resendInterval: 0,
        upsideDown: false,
        config: { url: 'https://example.com' },
        lastStatus: null,
        lastPing: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.monitor.create.mockResolvedValue(monitor);

      const result = await service.create(1, {
        name: 'Test',
        type: 'http',
        config: { url: 'https://example.com' },
      });

      expect(mockPrisma.monitor.create).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'check',
        { monitorId: 1 },
        expect.objectContaining({ jobId: 'monitor-1' }),
      );
      expect(result).toEqual(monitor);
    });

    it('generates pushToken for push type', async () => {
      const monitor = {
        id: 2,
        userId: 1,
        name: 'Push Monitor',
        type: 'push',
        active: true,
        interval: 60,
        config: { pushToken: 'abc123' },
      };
      mockPrisma.monitor.create.mockResolvedValue(monitor);

      await service.create(1, {
        name: 'Push Monitor',
        type: 'push',
        config: {},
      });

      const createCall = mockPrisma.monitor.create.mock.calls[0][0];
      expect(createCall.data.config.pushToken).toBeDefined();
      expect(typeof createCall.data.config.pushToken).toBe('string');
      expect(createCall.data.config.pushToken.length).toBe(64);
      // push monitors do NOT schedule jobs
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for missing monitor', async () => {
      mockPrisma.monitor.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for wrong user', async () => {
      mockPrisma.monitor.findUnique.mockResolvedValue({ id: 1, userId: 2 });
      await expect(service.findOne(1, 1, 'USER')).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to access any monitor', async () => {
      const monitor = { id: 1, userId: 2, name: 'Test' };
      mockPrisma.monitor.findUnique.mockResolvedValue(monitor);
      await expect(service.findOne(1, 1, 'ADMIN')).resolves.toEqual(monitor);
    });
  });

  describe('remove', () => {
    it('removes job and deletes monitor', async () => {
      const monitor = { id: 1, userId: 1, type: 'http' };
      mockPrisma.monitor.findUnique.mockResolvedValue(monitor);
      mockPrisma.monitor.delete.mockResolvedValue(monitor);
      mockQueue.getRepeatableJobs.mockResolvedValue([
        { id: 'monitor-1', key: 'repeat:monitor-1' },
      ]);

      const result = await service.remove(1, 1);

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('repeat:monitor-1');
      expect(mockPrisma.monitor.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ message: 'Monitor #1 deleted' });
    });
  });

  describe('writeHeartbeat', () => {
    it('detects status change and returns changed=true with previousStatus=null on first check', async () => {
      const monitor = { id: 1, userId: 1, lastStatus: null, lastPing: null };
      mockPrisma.monitor.findUnique.mockResolvedValue(monitor);
      mockPrisma.heartbeat.create.mockResolvedValue({});
      mockPrisma.monitor.update.mockResolvedValue({});

      const result = await service.writeHeartbeat(1, { status: true, ping: 100, message: 'OK' });

      expect(result.changed).toBe(true);
      expect(result.previousStatus).toBeNull();
      expect(mockPrisma.heartbeat.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            monitorId: 1,
            status: true,
            ping: 100,
            important: true,
          }),
        }),
      );
    });

    it('returns changed=false when status unchanged', async () => {
      const monitor = { id: 1, userId: 1, lastStatus: true, lastPing: 100 };
      mockPrisma.monitor.findUnique.mockResolvedValue(monitor);
      mockPrisma.heartbeat.create.mockResolvedValue({});
      mockPrisma.monitor.update.mockResolvedValue({});

      const result = await service.writeHeartbeat(1, { status: true, ping: 120, message: 'OK' });

      expect(result.changed).toBe(false);
      expect(result.previousStatus).toBe(true);
    });
  });

  describe('pause', () => {
    it('sets active=false and removes job', async () => {
      const monitor = { id: 1, userId: 1, active: true, type: 'http' };
      mockPrisma.monitor.findUnique.mockResolvedValue(monitor);
      mockPrisma.monitor.update.mockResolvedValue({ ...monitor, active: false });
      mockQueue.getRepeatableJobs.mockResolvedValue([]);

      await service.pause(1, 1);

      expect(mockPrisma.monitor.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { active: false },
      });
    });
  });

  describe('resume', () => {
    it('sets active=true and schedules job', async () => {
      const monitor = { id: 1, userId: 1, active: false, type: 'http', interval: 60 };
      mockPrisma.monitor.findUnique.mockResolvedValue(monitor);
      mockPrisma.monitor.update.mockResolvedValue({ ...monitor, active: true });
      mockQueue.getRepeatableJobs.mockResolvedValue([]);

      await service.resume(1, 1);

      expect(mockPrisma.monitor.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { active: true },
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        'check',
        { monitorId: 1 },
        expect.objectContaining({ jobId: 'monitor-1' }),
      );
    });
  });
});
