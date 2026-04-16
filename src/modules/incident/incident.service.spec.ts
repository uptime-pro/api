import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { IncidentService } from './incident.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SubscriberService } from '../status-page/subscriber.service.js';

const mockPrisma = {
  statusPage: {
    findUnique: jest.fn(),
  },
  incident: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  incidentUpdate: {
    create: jest.fn(),
  },
};

const mockSubscriberService = {
  notifySubscribers: jest.fn().mockResolvedValue(undefined),
};

const makeStatusPage = (overrides = {}) => ({
  id: 1,
  userId: 10,
  name: 'My Status Page',
  slug: 'my-status-page',
  ...overrides,
});

const makeIncident = (overrides = {}) => ({
  id: 1,
  statusPageId: 1,
  title: 'API Outage',
  content: 'We are investigating',
  severity: 'MINOR',
  status: 'INVESTIGATING',
  pinned: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  statusPage: makeStatusPage(),
  updates: [],
  ...overrides,
});

describe('IncidentService', () => {
  let service: IncidentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SubscriberService, useValue: mockSubscriberService },
      ],
    }).compile();

    service = module.get<IncidentService>(IncidentService);
    jest.clearAllMocks();
    mockSubscriberService.notifySubscribers.mockResolvedValue(undefined);
  });

  describe('findAll', () => {
    it('returns incidents for a status page owned by user', async () => {
      mockPrisma.statusPage.findUnique.mockResolvedValue(makeStatusPage());
      mockPrisma.incident.findMany.mockResolvedValue([makeIncident()]);
      const result = await service.findAll(1, 10);
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException when status page not found', async () => {
      mockPrisma.statusPage.findUnique.mockResolvedValue(null);
      await expect(service.findAll(99, 10)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when status page belongs to another user', async () => {
      mockPrisma.statusPage.findUnique.mockResolvedValue(makeStatusPage({ userId: 99 }));
      await expect(service.findAll(1, 10)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('returns incident for correct owner', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue(makeIncident());
      const result = await service.findOne(1, 10);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when incident not found', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue(null);
      await expect(service.findOne(99, 10)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when status page belongs to another user', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue(
        makeIncident({ statusPage: makeStatusPage({ userId: 99 }) }),
      );
      await expect(service.findOne(1, 10)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('creates incident and notifies subscribers', async () => {
      mockPrisma.statusPage.findUnique.mockResolvedValue(makeStatusPage());
      const created = makeIncident();
      mockPrisma.incident.create.mockResolvedValue(created);

      const result = await service.create(1, 10, {
        title: 'API Outage',
        content: 'We are investigating',
      });

      expect(mockPrisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ statusPageId: 1, title: 'API Outage' }),
        }),
      );
      expect(mockSubscriberService.notifySubscribers).toHaveBeenCalledWith(1, expect.any(Object));
      expect(result.title).toBe('API Outage');
    });

    it('throws ForbiddenException when status page belongs to another user', async () => {
      mockPrisma.statusPage.findUnique.mockResolvedValue(makeStatusPage({ userId: 99 }));
      await expect(service.create(1, 10, { title: 'x', content: 'y' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addUpdate', () => {
    it('creates incident update and updates parent status', async () => {
      const incident = makeIncident({ status: 'INVESTIGATING' });
      mockPrisma.incident.findUnique.mockResolvedValue(incident);
      const update = { id: 1, incidentId: 1, content: 'Fixed', status: 'RESOLVED', createdAt: new Date() };
      mockPrisma.incidentUpdate.create.mockResolvedValue(update);
      mockPrisma.incident.update.mockResolvedValue({ ...incident, status: 'RESOLVED' });

      const result = await service.addUpdate(1, 10, { content: 'Fixed', status: 'RESOLVED' });

      expect(mockPrisma.incident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { status: 'RESOLVED' },
        }),
      );
      expect(mockSubscriberService.notifySubscribers).toHaveBeenCalled();
      expect(result.content).toBe('Fixed');
    });

    it('does not notify subscribers when status unchanged', async () => {
      const incident = makeIncident({ status: 'INVESTIGATING' });
      mockPrisma.incident.findUnique.mockResolvedValue(incident);
      mockPrisma.incidentUpdate.create.mockResolvedValue({ id: 1 });
      mockPrisma.incident.update.mockResolvedValue(incident);

      await service.addUpdate(1, 10, { content: 'Still checking', status: 'INVESTIGATING' });
      expect(mockSubscriberService.notifySubscribers).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when incident belongs to another user', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue(
        makeIncident({ statusPage: makeStatusPage({ userId: 99 }) }),
      );
      await expect(
        service.addUpdate(1, 10, { content: 'x', status: 'RESOLVED' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('deletes incident', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue(makeIncident());
      mockPrisma.incident.delete.mockResolvedValue({});
      const result = await service.remove(1, 10);
      expect(mockPrisma.incident.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result.message).toContain('1');
    });

    it('throws NotFoundException when incident not found', async () => {
      mockPrisma.incident.findUnique.mockResolvedValue(null);
      await expect(service.remove(99, 10)).rejects.toThrow(NotFoundException);
    });
  });
});
