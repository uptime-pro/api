import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { JwtService } from '@nestjs/jwt';
import { IncomingMessage } from 'node:http';
import { Logger } from '@nestjs/common';

interface HeartbeatEventDto {
  monitorId: number;
  status: boolean;
  ping: number;
  msg: string;
  createdAt: string;
}

interface MonitorStatusEventDto {
  monitorId: number;
  status: boolean;
  previousStatus: boolean | null;
  ping: number;
  msg: string;
  createdAt: string;
}

@WebSocketGateway({ path: '/ws' })
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WsGateway.name);
  private clients = new Map<number, Set<WebSocket>>();

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: WebSocket, req: IncomingMessage): void {
    try {
      const cookieHeader = req.headers.cookie ?? '';
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [k, ...v] = c.trim().split('=');
          return [k, v.join('=')];
        }),
      );
      const token = cookies['access_token'];
      if (!token) {
        client.close(1008, 'Unauthorized');
        return;
      }
      const payload = this.jwtService.verify<{ sub: number; role: string }>(token);
      const userId = payload.sub;
      (client as WebSocket & { userId: number }).userId = userId;
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId)!.add(client);
      this.logger.debug(`WS connected: user ${userId}`);
    } catch {
      client.close(1008, 'Unauthorized');
    }
  }

  handleDisconnect(client: WebSocket): void {
    const userId = (client as WebSocket & { userId?: number }).userId;
    if (userId !== undefined) {
      const set = this.clients.get(userId);
      if (set) {
        set.delete(client);
        if (set.size === 0) this.clients.delete(userId);
      }
    }
  }

  emitHeartbeat(userId: number, data: HeartbeatEventDto): void {
    this.sendToUser(userId, { event: 'heartbeat', data });
  }

  emitMonitorStatus(userId: number, data: MonitorStatusEventDto): void {
    this.sendToUser(userId, { event: 'monitorStatus', data });
  }

  private sendToUser(userId: number, payload: object): void {
    const userClients = this.clients.get(userId);
    if (!userClients) return;
    const msg = JSON.stringify(payload);
    for (const c of userClients) {
      if (c.readyState === WebSocket.OPEN) {
        c.send(msg);
      }
    }
  }
}
