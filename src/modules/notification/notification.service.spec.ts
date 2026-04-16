import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationService } from './notification.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EncryptionService } from '../../encryption/encryption.service.js';
import { NotificationStrategyRegistry } from './strategies/notification-strategy.registry.js';
import { NOTIFICATION_QUEUE } from '../../queue/queue.module.js';

const mockPrisma = {
  notification: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  monitor: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  monitorNotification: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEncryption = {
  encrypt: jest.fn((v: string) => `enc:${v}`),
  decrypt: jest.fn((v: string) => v.replace('enc:', '')),
};

const mockStrategy = {
  send: jest.fn().mockResolvedValue(undefined),
};

const mockRegistry = {
  getStrategy: jest.fn().mockReturnValue(mockStrategy),
};

const mockQueue = {
  add: jest.fn(),
};

const makeNotification = (overrides = {}) => ({
  id: 1,
  userId: 10,
  name: 'Test Webhook',
  type: 'webhook',
  config: { webhookUrl: 'https://hooks.example.com' },
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EncryptionService, useValue: mockEncryption },
        { provide: NotificationStrategyRegistry, useValue: mockRegistry },
        { provide: getQueueToken(NOTIFICATION_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    jest.clearAllMocks();
    mockEncryption.encrypt.mockImplementation((v: string) => `enc:${v}`);
    mockEncryption.decrypt.mockImplementation((v: string) => v.replace('enc:', ''));
    mockRegistry.getStrategy.mockReturnValue(mockStrategy);
  });

  describe('findAll', () => {
    it('returns notifications filtered by userId', async () => {
      const notif = makeNotification();
      mockPrisma.notification.findMany.mockResolvedValue([notif]);
      const result = await service.findAll(10);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({ where: { userId: 10 } });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('returns all notifications for ADMIN role', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      await service.findAll(10, 'ADMIN');
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({ where: {} });
    });

    it('redacts sensitive config fields', async () => {
      const notif = makeNotification({ type: 'discord', config: { webhookUrl: 'https://discord.com/secret' } });
      mockPrisma.notification.findMany.mockResolvedValue([notif]);
      const result = await service.findAll(10);
      expect(result[0].config).toHaveProperty('webhookUrl', '***');
    });
  });

  describe('findOne', () => {
    it('returns notification for correct owner', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(makeNotification());
      const result = await service.findOne(1, 10);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.findOne(99, 10)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when wrong user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(makeNotification({ userId: 99 }));
      await expect(service.findOne(1, 10)).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN to access any notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(makeNotification({ userId: 99 }));
      const result = await service.findOne(1, 10, 'ADMIN');
      expect(result.id).toBe(1);
    });
  });

  describe('create', () => {
    it('creates notification with encrypted config for sensitive type', async () => {
      const notif = makeNotification({ type: 'discord', config: { webhookUrl: 'enc:https://discord.com/secret' } });
      mockPrisma.notification.create.mockResolvedValue(notif);

      const result = await service.create(10, {
        name: 'Test Webhook',
        type: 'discord',
        config: { webhookUrl: 'https://discord.com/secret' },
      });

      expect(mockEncryption.encrypt).toHaveBeenCalledWith('https://discord.com/secret');
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 10, type: 'discord' }),
        }),
      );
      expect(result.id).toBe(1);
    });

    it('creates notification without encryption for webhook type', async () => {
      const notif = makeNotification();
      mockPrisma.notification.create.mockResolvedValue(notif);

      await service.create(10, {
        name: 'Test Webhook',
        type: 'webhook',
        config: { webhookUrl: 'https://hooks.example.com' },
      });

      // webhook has no sensitive fields so encrypt should not be called
      expect(mockEncryption.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates notification and returns response', async () => {
      const existing = makeNotification();
      const updated = makeNotification({ name: 'Updated' });
      mockPrisma.notification.findUnique.mockResolvedValue(existing);
      mockPrisma.notification.update.mockResolvedValue(updated);

      const result = await service.update(1, 10, { name: 'Updated' });
      expect(mockPrisma.notification.update).toHaveBeenCalled();
      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.update(99, 10, { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when wrong user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(makeNotification({ userId: 99 }));
      await expect(service.update(1, 10, { name: 'X' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('deletes notification for correct owner', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(makeNotification());
      mockPrisma.notification.delete.mockResolvedValue({});
      await service.remove(1, 10);
      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.remove(99, 10)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when wrong user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(makeNotification({ userId: 99 }));
      await expect(service.remove(1, 10)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('sendTest', () => {
    it('calls strategy.send with test payload', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(makeNotification());
      await service.sendTest(1, 10);
      expect(mockRegistry.getStrategy).toHaveBeenCalledWith('webhook');
      expect(mockStrategy.send).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ monitorName: 'Test Monitor' }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.sendTest(99, 10)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when wrong user', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(makeNotification({ userId: 99 }));
      await expect(service.sendTest(1, 10)).rejects.toThrow(ForbiddenException);
    });
  });
});
