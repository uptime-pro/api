import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TagService } from './tag.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';

const mockPrisma = {
  tag: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  monitor: {
    findMany: jest.fn(),
  },
  monitorTag: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn() };

const makeTag = (overrides = {}) => ({
  id: 1,
  userId: 10,
  name: 'production',
  color: '#ff0000',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('TagService', () => {
  let service: TagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<TagService>(TagService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all tags for user', async () => {
      mockPrisma.tag.findMany.mockResolvedValue([makeTag()]);
      const result = await service.findAll(10);
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({ where: { userId: 10 } });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns tag for correct owner', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(makeTag());
      const result = await service.findOne(1, 10);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when tag not found', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);
      await expect(service.findOne(99, 10)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when wrong user', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(makeTag({ userId: 99 }));
      await expect(service.findOne(1, 10)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('creates tag and logs audit', async () => {
      const tag = makeTag();
      mockPrisma.tag.create.mockResolvedValue(tag);
      const result = await service.create(10, { name: 'production', color: '#ff0000' }, '127.0.0.1');
      expect(mockPrisma.tag.create).toHaveBeenCalledWith({ data: { name: 'production', color: '#ff0000', userId: 10 } });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ userId: 10, action: 'tag.create' }));
      expect(result.name).toBe('production');
    });
  });

  describe('update', () => {
    it('updates tag and logs audit', async () => {
      const existing = makeTag();
      const updated = makeTag({ name: 'staging' });
      mockPrisma.tag.findUnique.mockResolvedValue(existing);
      mockPrisma.tag.update.mockResolvedValue(updated);

      const result = await service.update(1, 10, { name: 'staging' }, '127.0.0.1');
      expect(mockPrisma.tag.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: 'staging' } });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'tag.update' }));
      expect(result.name).toBe('staging');
    });

    it('throws ForbiddenException when updating tag owned by another user', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(makeTag({ userId: 99 }));
      await expect(service.update(1, 10, { name: 'x' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('deletes tag and logs audit', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(makeTag());
      mockPrisma.tag.delete.mockResolvedValue({});
      await service.delete(1, 10, '127.0.0.1');
      expect(mockPrisma.tag.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'tag.delete' }));
    });

    it('throws ForbiddenException when deleting tag owned by another user', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(makeTag({ userId: 99 }));
      await expect(service.delete(1, 10)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setMonitors', () => {
    it('assigns monitors to tag', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(makeTag());
      mockPrisma.monitor.findMany.mockResolvedValue([{ id: 5 }, { id: 6 }]);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.setMonitors(1, 10, [5, 6], '127.0.0.1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'tag.setMonitors' }));
      expect(result).toEqual({ monitorIds: [5, 6] });
    });

    it('throws ForbiddenException when a monitor belongs to another user', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(makeTag());
      // Only 1 returned for 2 requested — one isn't owned by user
      mockPrisma.monitor.findMany.mockResolvedValue([{ id: 5 }]);

      await expect(service.setMonitors(1, 10, [5, 6])).rejects.toThrow(ForbiddenException);
    });

    it('allows setting empty monitor list', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(makeTag());
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.setMonitors(1, 10, []);
      expect(result).toEqual({ monitorIds: [] });
      expect(mockPrisma.monitor.findMany).not.toHaveBeenCalled();
    });
  });
});
