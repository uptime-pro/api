import { Test, TestingModule } from '@nestjs/testing';
import { PushStrategy } from './push.strategy.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

const mockPrisma = {
  heartbeat: {
    findFirst: jest.fn(),
  },
};

describe('PushStrategy', () => {
  let strategy: PushStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushStrategy,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    strategy = module.get<PushStrategy>(PushStrategy);
  });

  it('returns status=true for recent heartbeat (within interval * 2)', async () => {
    const recentTime = new Date(Date.now() - 30 * 1000); // 30s ago
    mockPrisma.heartbeat.findFirst.mockResolvedValue({ createdAt: recentTime });

    const result = await strategy.check({ monitorId: 1, interval: 60 });

    expect(result.status).toBe(true);
    expect(result.message).toContain('ago');
  });

  it('returns status=false for stale heartbeat (older than interval * 2)', async () => {
    const staleTime = new Date(Date.now() - 300 * 1000); // 300s ago, threshold is 120s
    mockPrisma.heartbeat.findFirst.mockResolvedValue({ createdAt: staleTime });

    const result = await strategy.check({ monitorId: 1, interval: 60 });

    expect(result.status).toBe(false);
    expect(result.message).toContain('ago');
  });

  it('returns status=false when no heartbeat has ever been received', async () => {
    mockPrisma.heartbeat.findFirst.mockResolvedValue(null);

    const result = await strategy.check({ monitorId: 1, interval: 60 });

    expect(result.status).toBe(false);
    expect(result.message).toContain('No heartbeat');
  });
});
