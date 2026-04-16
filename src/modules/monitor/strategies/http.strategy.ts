import { Injectable } from '@nestjs/common';
import type { CheckResult, MonitorStrategy } from './monitor-strategy.interface.js';
import { performance } from 'node:perf_hooks';

@Injectable()
export class HttpStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const url = config['url'] as string;
    const method = (config['method'] as string | undefined) ?? 'GET';
    const expectedStatus = (config['expectedStatus'] as number | undefined) ?? 200;
    const keyword = config['keyword'] as string | undefined;

    const start = performance.now();
    try {
      const response = await fetch(url, { method });
      const ping = Math.round(performance.now() - start);

      if (response.status !== expectedStatus) {
        return {
          status: false,
          ping,
          message: `HTTP ${response.status} (expected ${expectedStatus}) in ${ping}ms`,
        };
      }

      if (keyword) {
        const body = await response.text();
        if (!body.includes(keyword)) {
          return {
            status: false,
            ping,
            message: `Keyword "${keyword}" not found in response (${ping}ms)`,
          };
        }
      }

      return {
        status: true,
        ping,
        message: `HTTP ${response.status} OK in ${ping}ms`,
      };
    } catch (err) {
      const ping = Math.round(performance.now() - start);
      return {
        status: false,
        ping,
        message: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
