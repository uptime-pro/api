import { Injectable } from '@nestjs/common';
import net from 'node:net';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

// TCP connection check to SIP port (default 5060).
// Full SIP OPTIONS check would require a SIP library.
@Injectable()
export class SipStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const host = config['host'] as string;
    const port = (config['port'] as number | undefined) || 5060;
    const start = Date.now();
    return new Promise<CheckResult>((resolve) => {
      const socket = net.createConnection({ host, port });
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ status: false, ping: 0, message: 'SIP connection timed out' });
      }, 10000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        const ping = Date.now() - start;
        socket.destroy();
        resolve({ status: true, ping, message: `SIP server reachable at ${host}:${port}` });
      });

      socket.on('error', (err: Error) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ status: false, ping: 0, message: err.message });
      });
    });
  }
}
