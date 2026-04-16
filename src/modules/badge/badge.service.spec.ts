import { Test, TestingModule } from '@nestjs/testing';
import { BadgeService } from './badge.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const mockPrisma = {
  monitor: {
    findUnique: jest.fn(),
  },
  heartbeat: {
    count: jest.fn(),
  },
};

const makeMonitor = (overrides = {}) => ({
  id: 1,
  name: 'My Monitor',
  lastStatus: null,
  ...overrides,
});

describe('BadgeService', () => {
  let service: BadgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BadgeService>(BadgeService);
    jest.clearAllMocks();
  });

  describe('getStatusBadge', () => {
    it('returns SVG with "up" when lastStatus=true', async () => {
      mockPrisma.monitor.findUnique.mockResolvedValue(makeMonitor({ lastStatus: true }));
      const svg = await service.getStatusBadge(1);
      expect(svg).toContain('<svg');
      expect(svg).toContain('up');
      expect(svg).toContain('#4c1');
    });

    it('returns SVG with "down" when lastStatus=false', async () => {
      mockPrisma.monitor.findUnique.mockResolvedValue(makeMonitor({ lastStatus: false }));
      const svg = await service.getStatusBadge(1);
      expect(svg).toContain('down');
      expect(svg).toContain('#e05d44');
    });

    it('returns SVG with "pending" when lastStatus=null', async () => {
      mockPrisma.monitor.findUnique.mockResolvedValue(makeMonitor({ lastStatus: null }));
      const svg = await service.getStatusBadge(1);
      expect(svg).toContain('pending');
    });

    it('returns SVG with "unknown" when monitor not found', async () => {
      mockPrisma.monitor.findUnique.mockResolvedValue(null);
      const svg = await service.getStatusBadge(999);
      expect(svg).toContain('unknown');
    });
  });

  describe('getUptimeBadge', () => {
    it('returns SVG with percentage when data available', async () => {
      mockPrisma.monitor.findUnique.mockResolvedValue(makeMonitor());
      mockPrisma.heartbeat.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(99);  // up

      const svg = await service.getUptimeBadge(1);
      expect(svg).toContain('<svg');
      expect(svg).toContain('99.0%');
      expect(svg).toContain('#4c1'); // green for >= 99%
    });

    it('returns yellow badge for uptime between 95-99%', async () => {
      mockPrisma.monitor.findUnique.mockResolvedValue(makeMonitor());
      mockPrisma.heartbeat.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(97);

      const svg = await service.getUptimeBadge(1);
      expect(svg).toContain('#dfb317'); // yellow
    });

    it('returns red badge for uptime below 95%', async () => {
      mockPrisma.monitor.findUnique.mockResolvedValue(makeMonitor());
      mockPrisma.heartbeat.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(90);

      const svg = await service.getUptimeBadge(1);
      expect(svg).toContain('#e05d44'); // red
    });

    it('returns "no data" when no heartbeats', async () => {
      mockPrisma.monitor.findUnique.mockResolvedValue(makeMonitor());
      mockPrisma.heartbeat.count.mockResolvedValue(0);
      const svg = await service.getUptimeBadge(1);
      expect(svg).toContain('no data');
    });

    it('returns "unknown" when monitor not found', async () => {
      mockPrisma.monitor.findUnique.mockResolvedValue(null);
      const svg = await service.getUptimeBadge(999);
      expect(svg).toContain('unknown');
    });
  });
});
