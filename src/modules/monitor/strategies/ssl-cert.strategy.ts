import { Injectable } from '@nestjs/common';
import type { CheckResult, MonitorStrategy } from './monitor-strategy.interface.js';
import { checkSslCert } from './ssl-cert.util.js';

@Injectable()
export class SslCertStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const host = config['host'] as string;
    const port = config['port'] as number | undefined;
    const warningDays = config['warningDays'] as number | undefined;
    const criticalDays = config['criticalDays'] as number | undefined;
    const timeout = config['timeout'] as number | undefined;

    const result = await checkSslCert(host, { port, warningDays, criticalDays, timeout });
    return { status: result.status, ping: result.ping, message: result.message, meta: result.meta };
  }
}
