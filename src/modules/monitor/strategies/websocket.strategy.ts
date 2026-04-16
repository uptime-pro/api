import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';
import { checkSslCert } from './ssl-cert.util.js';

@Injectable()
export class WebSocketStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const url = config['url'] as string;
    const checkSsl = (config['checkSsl'] as boolean | undefined) ?? false;
    const sslWarningDays = config['sslWarningDays'] as number | undefined;
    const sslCriticalDays = config['sslCriticalDays'] as number | undefined;

    const start = Date.now();
    const wsResult = await new Promise<CheckResult>((resolve) => {
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

    if (!wsResult.status || !checkSsl) {
      return wsResult;
    }

    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'wss:') {
      return wsResult;
    }

    const hostname = parsedUrl.hostname;
    const sslResult = await checkSslCert(hostname, {
      warningDays: sslWarningDays,
      criticalDays: sslCriticalDays,
    });

    return {
      status: sslResult.status ? wsResult.status : false,
      ping: wsResult.ping,
      message: `${wsResult.message} | ${sslResult.message}`,
      meta: { ssl: sslResult.meta },
    };
  }
}
