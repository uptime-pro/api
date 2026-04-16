import { Injectable } from '@nestjs/common';
import { exec } from 'node:child_process';
import type { CheckResult, MonitorStrategy } from './monitor-strategy.interface.js';

@Injectable()
export class PingStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const host = config['host'] as string;

    return new Promise<CheckResult>((resolve) => {
      const start = Date.now();
      exec(`ping -c 1 -W 3 ${host}`, (error, stdout) => {
        const elapsed = Date.now() - start;
        if (error) {
          resolve({
            status: false,
            ping: elapsed,
            message: `Ping to ${host} failed: ${error.message}`,
          });
          return;
        }

        // Parse time=X.X ms from ping output
        const match = stdout.match(/time[=<]([\d.]+)\s*ms/);
        if (!match) {
          resolve({
            status: false,
            ping: elapsed,
            message: `Ping to ${host}: no response time found in output`,
          });
          return;
        }

        const ping = Math.round(parseFloat(match[1]));
        resolve({
          status: true,
          ping,
          message: `Ping to ${host}: ${ping}ms`,
        });
      });
    });
  }
}
