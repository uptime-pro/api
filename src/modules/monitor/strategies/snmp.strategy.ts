import { Injectable } from '@nestjs/common';
// @ts-ignore - net-snmp types may be incomplete
import * as snmp from 'net-snmp';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class SnmpStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    const host = config['host'] as string;
    const community = (config['community'] as string | undefined) || 'public';
    const oid = (config['oid'] as string | undefined) || '1.3.6.1.2.1.1.1.0'; // sysDescr
    const version = (config['version'] as number | undefined) || snmp.Version2c;
    const port = (config['port'] as number | undefined) || 161;

    return new Promise<CheckResult>((resolve) => {
      const timeout = setTimeout(() => {
        try { session.close(); } catch { /* ignore */ }
        resolve({ status: false, ping: 0, message: 'SNMP request timed out' });
      }, 10000);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = (snmp as any).createSession(host, community, { version, port, timeout: 9000 });

      session.get([oid], (error: Error | null, varbinds: unknown[]) => {
        clearTimeout(timeout);
        try { session.close(); } catch { /* ignore */ }
        if (error) {
          resolve({ status: false, ping: 0, message: error.message });
        } else {
          const ping = Date.now() - start;
          resolve({ status: true, ping, message: `SNMP GET ${oid}: ${varbinds?.length ?? 0} varbind(s)` });
        }
      });
    });
  }
}
