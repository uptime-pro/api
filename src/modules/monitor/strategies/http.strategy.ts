import { Injectable } from '@nestjs/common';
import type { CheckResult, MonitorStrategy } from './monitor-strategy.interface.js';
import { performance } from 'node:perf_hooks';
import { checkSslCert } from './ssl-cert.util.js';
import { checkDomainExpiry } from './domain-expiry.util.js';

@Injectable()
export class HttpStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const url = config['url'] as string;
    const method = (config['method'] as string | undefined) ?? 'GET';
    const expectedStatus = (config['expectedStatus'] as number | undefined) ?? 200;
    const keyword = config['keyword'] as string | undefined;
    const checkSsl = (config['checkSsl'] as boolean | undefined) ?? false;
    const sslWarningDays = config['sslWarningDays'] as number | undefined;
    const sslCriticalDays = config['sslCriticalDays'] as number | undefined;
    const checkDomain = (config['checkDomain'] as boolean | undefined) ?? false;
    const domainWarningDays = config['domainWarningDays'] as number | undefined;
    const domainCriticalDays = config['domainCriticalDays'] as number | undefined;

    const start = performance.now();
    let httpResult: CheckResult;
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

      httpResult = {
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

    // HTTP check failed — short-circuit
    if (!httpResult.status) {
      return httpResult;
    }

    const { ping } = httpResult;
    let combinedStatus = true;
    let combinedMessage = httpResult.message;
    const combinedMeta: Record<string, unknown> = {};

    if (checkSsl) {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'https:') {
        const hostname = parsedUrl.hostname;
        const sslResult = await checkSslCert(hostname, {
          warningDays: sslWarningDays,
          criticalDays: sslCriticalDays,
        });
        combinedMeta['ssl'] = sslResult.meta;
        combinedMessage = `${combinedMessage} | ${sslResult.message}`;
        if (!sslResult.status) {
          combinedStatus = false;
        }
      }
    }

    if (combinedStatus && checkDomain) {
      const hostname = new URL(url).hostname;
      const domainResult = await checkDomainExpiry(hostname, {
        warningDays: domainWarningDays,
        criticalDays: domainCriticalDays,
      });
      combinedMeta['domain'] = domainResult.meta;
      combinedMessage = `${combinedMessage} | ${domainResult.message}`;
      if (!domainResult.status) {
        combinedStatus = false;
      }
    }

    return {
      status: combinedStatus,
      ping,
      message: combinedMessage,
      ...(Object.keys(combinedMeta).length > 0 ? { meta: combinedMeta } : {}),
    };
  }
}
