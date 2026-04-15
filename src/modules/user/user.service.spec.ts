import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { JwtPayload } from '../../decorators/current-user.decorator.js';

const adminUser: JwtPayload = { sub: 1, username: 'admin', role: 'ADMIN' };
const viewerUser: JwtPayload = { sub: 2, username: 'viewer', role: 'VIEWER' };

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return sanitized user list', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 1, username: 'admin', password: 'hash', twoFaSecret: null, backupCodes: [], role: 'ADMIN', active: true, email: null, twoFaActive: false, timezone: null, theme: 'auto', createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('password');
      expect(result[0]).not.toHaveProperty('twoFaSecret');
      expect(result[0]).not.toHaveProperty('backupCodes');
    });
  });

  describe('findOne', () => {
    it('should return sanitized user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, username: 'admin', password: 'hash', twoFaSecret: null, backupCodes: [], role: 'ADMIN', active: true, email: null, twoFaActive: false, timezone: null, theme: 'auto', createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.findOne(1);
      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('username', 'admin');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a user with hashed password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 2, username: 'newuser', password: 'hashed', email: null, twoFaSecret: null, backupCodes: [], role: 'VIEWER', active: true, twoFaActive: false, timezone: null, theme: 'auto', createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.create({ username: 'newuser', password: 'password123' });
      expect(result).not.toHaveProperty('password');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ username: 'newuser' }),
        }),
      );

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe('password123');
      const isHashed = await bcrypt.compare('password123', createCall.data.password);
      expect(isHashed).toBe(true);
    });

    it('should throw ConflictException when username already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'existing' });
      await expect(service.create({ username: 'existing', password: 'password123' })).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should allow admin to change user role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, username: 'viewer', password: 'hash', twoFaSecret: null, backupCodes: [] });
      mockPrisma.user.update.mockResolvedValue({ id: 2, username: 'viewer', role: 'EDITOR', password: 'hash', twoFaSecret: null, backupCodes: [], active: true, email: null, twoFaActive: false, timezone: null, theme: 'auto', createdAt: new Date(), updatedAt: new Date() });

      const result = await service.update(2, { role: 'EDITOR' as any }, adminUser);
      expect(result).not.toHaveProperty('password');
    });

    it('should throw ForbiddenException when viewer tries to change role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, username: 'viewer', password: 'hash', twoFaSecret: null, backupCodes: [] });
      await expect(service.update(2, { role: 'ADMIN' as any }, viewerUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when viewer tries to update another user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin', password: 'hash', twoFaSecret: null, backupCodes: [] });
      await expect(service.update(1, { theme: 'dark' }, viewerUser)).rejects.toThrow(ForbiddenException);
    });

    it('should allow user to update their own account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, username: 'viewer', password: 'hash', twoFaSecret: null, backupCodes: [] });
      mockPrisma.user.update.mockResolvedValue({ id: 2, username: 'viewer', theme: 'dark', role: 'VIEWER', password: 'hash', twoFaSecret: null, backupCodes: [], active: true, email: null, twoFaActive: false, timezone: null, createdAt: new Date(), updatedAt: new Date() });

      const result = await service.update(2, { theme: 'dark' }, viewerUser);
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.update(999, { theme: 'dark' }, adminUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin' });
      mockPrisma.user.delete.mockResolvedValue({});

      const result = await service.remove(1);
      expect(result.message).toContain('deleted');
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
