import { Test, TestingModule } from '@nestjs/testing';
import { TcpStrategy } from './tcp.strategy.js';
import * as net from 'node:net';
import { EventEmitter } from 'node:events';

jest.mock('node:net');

describe('TcpStrategy', () => {
  let strategy: TcpStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TcpStrategy],
    }).compile();
    strategy = module.get<TcpStrategy>(TcpStrategy);
  });

  it('returns status=true on successful connection', async () => {
    const mockSocket = new EventEmitter() as EventEmitter & { destroy: jest.Mock };
    mockSocket.destroy = jest.fn();
    (net.createConnection as jest.Mock).mockReturnValue(mockSocket);

    const checkPromise = strategy.check({ host: 'localhost', port: 80 });
    mockSocket.emit('connect');

    const result = await checkPromise;

    expect(result.status).toBe(true);
    expect(result.message).toContain('localhost:80');
    expect(mockSocket.destroy).toHaveBeenCalled();
  });

  it('returns status=false on connection error', async () => {
    const mockSocket = new EventEmitter() as EventEmitter & { destroy: jest.Mock };
    mockSocket.destroy = jest.fn();
    (net.createConnection as jest.Mock).mockReturnValue(mockSocket);

    const checkPromise = strategy.check({ host: 'localhost', port: 9999 });
    mockSocket.emit('error', new Error('ECONNREFUSED'));

    const result = await checkPromise;

    expect(result.status).toBe(false);
    expect(result.message).toContain('ECONNREFUSED');
  });
});
