import { Injectable } from '@nestjs/common';
import net from 'node:net';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

// TCP connection check to Steam game server port (default 27015).
// Full A2S_INFO query would require UDP; this verifies TCP reachability.
@Injectable()
export class SteamStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const host = config['host'] as string;
    const port = (config['port'] as number | undefined) || 27015;
    const start = Date.now();
    return new Promise<CheckResult>((resolve) => {
      const socket = net.createConnection({ host, port });
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ status: false, ping: 0, message: 'Steam server connection timed out' });
      }, 10000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        const ping = Date.now() - start;
        socket.destroy();
        resolve({ status: true, ping, message: `Steam server reachable at ${host}:${port}` });
      });

      socket.on('error', (err: Error) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ status: false, ping: 0, message: err.message });
      });
    });
  }
}
