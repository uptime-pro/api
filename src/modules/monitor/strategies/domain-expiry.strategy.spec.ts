import { Test, TestingModule } from '@nestjs/testing';
import { DomainExpiryStrategy } from './domain-expiry.strategy.js';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DomainExpiryStrategy', () => {
  let strategy: DomainExpiryStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [DomainExpiryStrategy],
    }).compile();
    strategy = module.get<DomainExpiryStrategy>(DomainExpiryStrategy);
  });

  function daysFromNow(days: number): string {
    return new Date(Date.now() + days * 86400000).toISOString();
  }

  function makeRdapResponse(expiryDays: number, registrarName?: string) {
    const events = [
      { eventAction: 'registration', eventDate: daysFromNow(-365) },
      { eventAction: 'expiration', eventDate: daysFromNow(expiryDays) },
    ];
    const entities = registrarName
      ? [{ roles: ['registrar'], vcardArray: ['vcard', [['fn', {}, 'text', registrarName]]] }]
      : [];
    return { events, entities };
  }

  function mockOkFetch(body: unknown) {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    });
  }

  it('returns status=true with domainState=healthy for domain expiring in 120 days', async () => {
    mockOkFetch(makeRdapResponse(120, 'GoDaddy LLC'));

    const result = await strategy.check({ domain: 'example.com' });

    expect(result.status).toBe(true);
    expect(result.message).toContain('DOMAIN OK');
    expect(result.meta?.domainState).toBe('healthy');
    expect(result.meta?.daysUntilExpiry as number).toBeGreaterThanOrEqual(119);
    expect(result.meta?.registrar).toBe('GoDaddy LLC');
  });

  it('returns status=true with domainState=warning for domain expiring in 20 days', async () => {
    mockOkFetch(makeRdapResponse(20));

    const result = await strategy.check({ domain: 'example.com' });

    expect(result.status).toBe(true);
    expect(result.message).toContain('DOMAIN WARNING');
    expect(result.meta?.domainState).toBe('warning');
  });

  it('returns status=false with domainState=critical for domain expiring in 7 days', async () => {
    mockOkFetch(makeRdapResponse(7));

    const result = await strategy.check({ domain: 'example.com' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('DOMAIN CRITICAL');
    expect(result.meta?.domainState).toBe('critical');
  });

  it('returns status=false with domainState=expired for an expired domain', async () => {
    mockOkFetch(makeRdapResponse(-5));

    const result = await strategy.check({ domain: 'example.com' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('DOMAIN EXPIRED');
    expect(result.meta?.domainState).toBe('expired');
  });

  it('returns status=false with domainState=unsupported for RDAP 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    const result = await strategy.check({ domain: 'example.xyz' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('RDAP not supported');
    expect(result.meta?.domainState).toBe('unsupported');
  });

  it('returns status=false with domainState=error on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await strategy.check({ domain: 'example.com' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('lookup failed');
    expect(result.meta?.domainState).toBe('error');
  });

  it('returns status=false when no expiration event is found in RDAP response', async () => {
    mockOkFetch({
      events: [{ eventAction: 'registration', eventDate: daysFromNow(-365) }],
      entities: [],
    });

    const result = await strategy.check({ domain: 'example.com' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('no expiry date');
  });

  it('parses registrar name from RDAP entity vcardArray', async () => {
    mockOkFetch(makeRdapResponse(120, 'Namecheap Inc.'));

    const result = await strategy.check({ domain: 'example.com' });

    expect(result.meta?.registrar).toBe('Namecheap Inc.');
  });
});
