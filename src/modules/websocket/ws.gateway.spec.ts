import { Test, TestingModule } from '@nestjs/testing';
import { WsGateway } from './ws.gateway.js';
import { JwtService } from '@nestjs/jwt';
import { WebSocket } from 'ws';
import { EventEmitter } from 'node:events';

const mockJwtService = {
  verify: jest.fn(),
};

function createMockClient() {
  const client = new EventEmitter() as EventEmitter & {
    close: jest.Mock;
    send: jest.Mock;
    readyState: number;
    userId?: number;
  };
  client.close = jest.fn();
  client.send = jest.fn();
  client.readyState = WebSocket.OPEN;
  return client;
}

function createMockRequest(cookie?: string) {
  return {
    headers: {
      cookie: cookie ?? '',
    },
  };
}

describe('WsGateway', () => {
  let gateway: WsGateway;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsGateway,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();
    gateway = module.get<WsGateway>(WsGateway);
  });

  describe('handleConnection', () => {
    it('adds client to map on valid JWT in cookie', () => {
      mockJwtService.verify.mockReturnValue({ sub: 1, role: 'USER' });
      const client = createMockClient();
      const req = createMockRequest('access_token=valid.jwt.token');

      gateway.handleConnection(client as unknown as WebSocket, req as never);

      expect(client.close).not.toHaveBeenCalled();
      expect((client as { userId?: number }).userId).toBe(1);
    });

    it('closes with 1008 on invalid JWT', () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      const client = createMockClient();
      const req = createMockRequest('access_token=bad.token');

      gateway.handleConnection(client as unknown as WebSocket, req as never);

      expect(client.close).toHaveBeenCalledWith(1008, 'Unauthorized');
    });

    it('closes with 1008 when no cookie present', () => {
      const client = createMockClient();
      const req = createMockRequest();

      gateway.handleConnection(client as unknown as WebSocket, req as never);

      expect(client.close).toHaveBeenCalledWith(1008, 'Unauthorized');
    });
  });

  describe('emitHeartbeat', () => {
    it('only sends to correct user clients', () => {
      mockJwtService.verify
        .mockReturnValueOnce({ sub: 1, role: 'USER' })
        .mockReturnValueOnce({ sub: 2, role: 'USER' });

      const client1 = createMockClient();
      const client2 = createMockClient();

      gateway.handleConnection(client1 as unknown as WebSocket, createMockRequest('access_token=token1') as never);
      gateway.handleConnection(client2 as unknown as WebSocket, createMockRequest('access_token=token2') as never);

      const event = { monitorId: 10, status: true, ping: 100, msg: 'OK', createdAt: new Date().toISOString() };
      gateway.emitHeartbeat(1, event);

      expect(client1.send).toHaveBeenCalledWith(JSON.stringify({ event: 'heartbeat', data: event }));
      expect(client2.send).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('removes client from clients map', () => {
      mockJwtService.verify.mockReturnValue({ sub: 1, role: 'USER' });
      const client = createMockClient();
      gateway.handleConnection(client as unknown as WebSocket, createMockRequest('access_token=token') as never);

      gateway.handleDisconnect(client as unknown as WebSocket);

      // After disconnect, emitHeartbeat should not send to client
      gateway.emitHeartbeat(1, { monitorId: 1, status: true, ping: 0, msg: '', createdAt: '' });
      expect(client.send).not.toHaveBeenCalled();
    });
  });
});
