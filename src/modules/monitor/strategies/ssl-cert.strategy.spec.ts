import { Test, TestingModule } from '@nestjs/testing';
import { SslCertStrategy } from './ssl-cert.strategy.js';
import * as tls from 'node:tls';

jest.mock('node:tls');

describe('SslCertStrategy', () => {
  let strategy: SslCertStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SslCertStrategy],
    }).compile();
    strategy = module.get<SslCertStrategy>(SslCertStrategy);
  });

  function daysFromNow(days: number): string {
    return new Date(Date.now() + days * 86400000).toISOString();
  }

  function makeMockSocket(cert: Record<string, unknown>) {
    return {
      getPeerCertificate: jest.fn().mockReturnValue(cert),
      setTimeout: jest.fn(),
      on: jest.fn(),
      destroy: jest.fn(),
    };
  }

  it('returns status=true with certState=healthy for cert expiring in 60 days', async () => {
    const mockSocket = makeMockSocket({
      valid_to: daysFromNow(60),
      valid_from: daysFromNow(-30),
      issuer: { O: "Let's Encrypt", CN: 'R3' },
      subject: { CN: 'example.com' },
    });
    (tls.connect as jest.Mock).mockImplementation((_opts, callback) => {
      setImmediate(callback);
      return mockSocket;
    });

    const result = await strategy.check({ host: 'example.com' });

    expect(result.status).toBe(true);
    expect(result.message).toContain('SSL OK');
    expect(result.meta?.certState).toBe('healthy');
    expect(result.meta?.daysUntilExpiry as number).toBeGreaterThanOrEqual(59);
    expect(result.meta?.issuer).toBe("Let's Encrypt");
    expect(result.meta?.expiryDate).toBeDefined();
  });

  it('returns status=true with certState=warning for cert expiring in 20 days', async () => {
    const mockSocket = makeMockSocket({
      valid_to: daysFromNow(20),
      valid_from: daysFromNow(-30),
      issuer: { O: 'DigiCert' },
      subject: { CN: 'example.com' },
    });
    (tls.connect as jest.Mock).mockImplementation((_opts, callback) => {
      setImmediate(callback);
      return mockSocket;
    });

    const result = await strategy.check({ host: 'example.com' });

    expect(result.status).toBe(true);
    expect(result.message).toContain('SSL WARNING');
    expect(result.meta?.certState).toBe('warning');
  });

  it('returns status=false with certState=critical for cert expiring in 7 days', async () => {
    const mockSocket = makeMockSocket({
      valid_to: daysFromNow(7),
      valid_from: daysFromNow(-30),
      issuer: { O: 'DigiCert' },
      subject: { CN: 'example.com' },
    });
    (tls.connect as jest.Mock).mockImplementation((_opts, callback) => {
      setImmediate(callback);
      return mockSocket;
    });

    const result = await strategy.check({ host: 'example.com' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('SSL CRITICAL');
    expect(result.meta?.certState).toBe('critical');
  });

  it('returns status=false with certState=expired for an expired cert', async () => {
    const mockSocket = makeMockSocket({
      valid_to: daysFromNow(-5),
      valid_from: daysFromNow(-365),
      issuer: { O: 'DigiCert' },
      subject: { CN: 'example.com' },
    });
    (tls.connect as jest.Mock).mockImplementation((_opts, callback) => {
      setImmediate(callback);
      return mockSocket;
    });

    const result = await strategy.check({ host: 'example.com' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('SSL EXPIRED');
    expect(result.meta?.certState).toBe('expired');
  });

  it('returns status=false with certState=error on connection error', async () => {
    const mockSocket = {
      getPeerCertificate: jest.fn(),
      setTimeout: jest.fn(),
      on: jest.fn().mockImplementation((event: string, handler: (err: Error) => void) => {
        if (event === 'error') setImmediate(() => handler(new Error('ECONNREFUSED')));
      }),
      destroy: jest.fn(),
    };
    (tls.connect as jest.Mock).mockReturnValue(mockSocket);

    const result = await strategy.check({ host: 'example.com' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('SSL check failed');
    expect(result.meta?.certState).toBe('error');
  });

  it('uses custom warningDays/criticalDays — cert at 25 days is critical when criticalDays=30', async () => {
    const mockSocket = makeMockSocket({
      valid_to: daysFromNow(25),
      valid_from: daysFromNow(-30),
      issuer: { O: 'DigiCert' },
      subject: { CN: 'example.com' },
    });
    (tls.connect as jest.Mock).mockImplementation((_opts, callback) => {
      setImmediate(callback);
      return mockSocket;
    });

    const result = await strategy.check({ host: 'example.com', warningDays: 60, criticalDays: 30 });

    expect(result.status).toBe(false);
    expect(result.meta?.certState).toBe('critical');
  });

  it('returns status=false with timed out message on socket timeout', async () => {
    const mockSocket = {
      getPeerCertificate: jest.fn(),
      setTimeout: jest.fn().mockImplementation((_ms: number, handler: () => void) => {
        setImmediate(handler);
      }),
      on: jest.fn(),
      destroy: jest.fn(),
    };
    (tls.connect as jest.Mock).mockReturnValue(mockSocket);

    const result = await strategy.check({ host: 'example.com' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('timed out');
  });
});
