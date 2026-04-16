import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ApiKeyService } from './api-key.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';

const mockPrisma = {
  apiKey: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

const makeApiKey = (overrides = {}) => ({
  id: 1,
  userId: 10,
  name: 'My API Key',
  key: 'hashed-key',
  permission: 'READ',
  expires: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns api keys without key material', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([makeApiKey()]);
      const result = await service.findAll(10);
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 10 } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('key');
    });
  });

  describe('create', () => {
    it('generates random key, hashes it, and returns raw key once', async () => {
      const created = makeApiKey();
      mockPrisma.apiKey.create.mockResolvedValue(created);

      const result = await service.create(10, { name: 'My API Key', permission: 'READ' }, '127.0.0.1');

      // The result should contain the raw key (not the hash)
      expect(result).toHaveProperty('key');
      expect(result.key).not.toBe('hashed-key');
      // key should be a hex string (64 chars for 32 bytes)
      expect(result.key).toMatch(/^[a-f0-9]{64}$/);

      // Verify the stored key is a bcrypt hash of the returned key
      const createCall = mockPrisma.apiKey.create.mock.calls[0][0];
      const isHashed = await bcrypt.compare(result.key, createCall.data.key);
      expect(isHashed).toBe(true);

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 10, action: 'apikey.create' }),
      );
    });

    it('stores expiry date when provided', async () => {
      const expiresAt = '2025-01-01T00:00:00Z';
      mockPrisma.apiKey.create.mockResolvedValue(makeApiKey({ expires: new Date(expiresAt) }));

      await service.create(10, { name: 'Expiring Key', permission: 'READ', expiresAt }, '127.0.0.1');

      const createCall = mockPrisma.apiKey.create.mock.calls[0][0];
      expect(createCall.data.expires).toEqual(new Date(expiresAt));
    });
  });

  describe('remove', () => {
    it('deletes api key for correct owner', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(makeApiKey());
      mockPrisma.apiKey.delete.mockResolvedValue({});

      const result = await service.remove(1, 10, '127.0.0.1');
      expect(mockPrisma.apiKey.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 10, action: 'apikey.delete' }),
      );
      expect(result.message).toContain('1');
    });

    it('throws NotFoundException when key not found', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);
      await expect(service.remove(99, 10)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when key belongs to another user', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(makeApiKey({ userId: 99 }));
      await expect(service.remove(1, 10)).rejects.toThrow(ForbiddenException);
    });
  });
});
