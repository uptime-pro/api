import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class WebSocketStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const url = config['url'] as string;
    const start = Date.now();
    return new Promise<CheckResult>((resolve) => {
      const timeout = setTimeout(() => {
        ws.terminate();
        resolve({ status: false, ping: 0, message: 'WebSocket connection timed out' });
      }, 10000);
      const ws = new WebSocket(url);
      ws.on('open', () => {
        clearTimeout(timeout);
        const ping = Date.now() - start;
        ws.close();
        resolve({ status: true, ping, message: 'WebSocket connection successful' });
      });
      ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        ws.terminate();
        resolve({ status: false, ping: 0, message: err.message });
      });
    });
  }
}
