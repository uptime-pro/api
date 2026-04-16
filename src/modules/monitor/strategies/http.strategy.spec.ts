import { Test, TestingModule } from '@nestjs/testing';
import { HttpStrategy } from './http.strategy.js';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('HttpStrategy', () => {
  let strategy: HttpStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpStrategy],
    }).compile();
    strategy = module.get<HttpStrategy>(HttpStrategy);
  });

  it('returns status=true for successful 200 response', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue('Hello World'),
    });

    const result = await strategy.check({ url: 'https://example.com' });

    expect(result.status).toBe(true);
    expect(result.ping).toBeGreaterThanOrEqual(0);
    expect(result.message).toContain('200');
  });

  it('returns status=false for network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await strategy.check({ url: 'https://unreachable.example.com' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('Network error');
  });

  it('returns status=false for wrong status code', async () => {
    mockFetch.mockResolvedValue({
      status: 404,
      text: jest.fn().mockResolvedValue('Not Found'),
    });

    const result = await strategy.check({ url: 'https://example.com', expectedStatus: 200 });

    expect(result.status).toBe(false);
    expect(result.message).toContain('404');
  });

  it('returns status=true when keyword is found in response body', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue('Welcome to example.com'),
    });

    const result = await strategy.check({ url: 'https://example.com', keyword: 'Welcome' });

    expect(result.status).toBe(true);
  });

  it('returns status=false when keyword is not found in response body', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue('Hello World'),
    });

    const result = await strategy.check({ url: 'https://example.com', keyword: 'MissingKeyword' });

    expect(result.status).toBe(false);
    expect(result.message).toContain('MissingKeyword');
  });
});
