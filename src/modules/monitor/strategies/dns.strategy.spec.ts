import { Test, TestingModule } from '@nestjs/testing';
import { DnsStrategy } from './dns.strategy.js';

jest.mock('node:dns/promises', () => ({
  __esModule: true,
  default: {
    resolve4: jest.fn(),
    resolve6: jest.fn(),
    resolveCname: jest.fn(),
    resolveMx: jest.fn(),
    resolveTxt: jest.fn(),
  },
}));

describe('DnsStrategy', () => {
  let strategy: DnsStrategy;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDns: any;

  beforeEach(async () => {
    mockDns = (jest.requireMock('node:dns/promises') as { default: Record<string, jest.Mock> }).default;
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [DnsStrategy],
    }).compile();
    strategy = module.get<DnsStrategy>(DnsStrategy);
  });

  it('returns status=true on successful A record resolution', async () => {
    mockDns.resolve4.mockResolvedValue(['1.2.3.4']);

    const result = await strategy.check({ host: 'example.com', type: 'A' });

    expect(result.status).toBe(true);
    expect(result.message).toContain('example.com');
  });

  it('returns status=false on resolution failure', async () => {
    mockDns.resolve4.mockRejectedValue(new Error('ENOTFOUND'));

    const result = await strategy.check({ host: 'nonexistent.example.com', type: 'A' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('ENOTFOUND');
  });

  it('returns status=true when expectedValue matches', async () => {
    mockDns.resolve4.mockResolvedValue(['1.2.3.4', '5.6.7.8']);

    const result = await strategy.check({
      host: 'example.com',
      type: 'A',
      expectedValue: '1.2.3.4',
    });

    expect(result.status).toBe(true);
  });

  it('returns status=false when expectedValue does not match', async () => {
    mockDns.resolve4.mockResolvedValue(['5.6.7.8']);

    const result = await strategy.check({
      host: 'example.com',
      type: 'A',
      expectedValue: '1.2.3.4',
    });

    expect(result.status).toBe(false);
    expect(result.message).toContain('expected');
  });
});


