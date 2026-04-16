import { Injectable } from '@nestjs/common';
import type { CheckResult, MonitorStrategy } from './monitor-strategy.interface.js';
import { checkDomainExpiry } from './domain-expiry.util.js';

@Injectable()
export class DomainExpiryStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const domain = config['domain'] as string;
    const warningDays = config['warningDays'] as number | undefined;
    const criticalDays = config['criticalDays'] as number | undefined;
    const timeout = config['timeout'] as number | undefined;

    const result = await checkDomainExpiry(domain, { warningDays, criticalDays, timeout });
    return { status: result.status, ping: result.ping, message: result.message, meta: result.meta };
  }
}
