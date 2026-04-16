import { Injectable } from '@nestjs/common';
import dns from 'node:dns/promises';
import type { CheckResult, MonitorStrategy } from './monitor-strategy.interface.js';

@Injectable()
export class DnsStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const host = config['host'] as string;
    const type = (config['type'] as string | undefined) ?? 'A';
    const expectedValue = config['expectedValue'] as string | undefined;

    const start = Date.now();
    try {
      const records = await this.resolve(host, type);
      const ping = Date.now() - start;

      if (expectedValue) {
        const matches = records.some((r) => r === expectedValue);
        if (!matches) {
          return {
            status: false,
            ping,
            message: `DNS ${type} for ${host}: expected "${expectedValue}" but got [${records.join(', ')}]`,
          };
        }
      }

      return {
        status: true,
        ping,
        message: `DNS ${type} for ${host} resolved in ${ping}ms: [${records.join(', ')}]`,
      };
    } catch (err) {
      const ping = Date.now() - start;
      return {
        status: false,
        ping,
        message: `DNS ${type} for ${host} failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async resolve(host: string, type: string): Promise<string[]> {
    switch (type.toUpperCase()) {
      case 'A':
        return dns.resolve4(host);
      case 'AAAA':
        return dns.resolve6(host);
      case 'CNAME':
        return dns.resolveCname(host);
      case 'MX': {
        const records = await dns.resolveMx(host);
        return records.map((r) => r.exchange);
      }
      case 'TXT': {
        const records = await dns.resolveTxt(host);
        return records.map((r) => r.join(''));
      }
      default:
        return dns.resolve4(host);
    }
  }
}
