import { Injectable } from '@nestjs/common';
import * as net from 'node:net';
import type { CheckResult, MonitorStrategy } from './monitor-strategy.interface.js';

@Injectable()
export class TcpStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const host = config['host'] as string;
    const port = config['port'] as number;
    const timeout = 5000;

    return new Promise<CheckResult>((resolve) => {
      const start = Date.now();
      const socket = net.createConnection({ host, port });

      const timer = setTimeout(() => {
        socket.destroy();
        resolve({
          status: false,
          ping: timeout,
          message: `TCP connection to ${host}:${port} timed out`,
        });
      }, timeout);

      socket.once('connect', () => {
        clearTimeout(timer);
        const ping = Date.now() - start;
        socket.destroy();
        resolve({
          status: true,
          ping,
          message: `TCP connected to ${host}:${port} in ${ping}ms`,
        });
      });

      socket.once('error', (err) => {
        clearTimeout(timer);
        const ping = Date.now() - start;
        socket.destroy();
        resolve({
          status: false,
          ping,
          message: `TCP connection to ${host}:${port} failed: ${err.message}`,
        });
      });
    });
  }
}
