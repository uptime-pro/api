import { Injectable } from '@nestjs/common';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

const execAsync = promisify(exec);

@Injectable()
export class TailscalePingStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const hostname = config['hostname'] as string;
    const start = Date.now();
    try {
      const { stdout } = await execAsync(
        `tailscale ping -c 1 --timeout=8s ${hostname}`,
        { timeout: 10000 },
      );
      const pingMs = parseFloat(stdout.match(/(\d+(?:\.\d+)?)ms/)?.[1] ?? '0');
      return {
        status: stdout.includes('pong'),
        ping: pingMs || (Date.now() - start),
        message: stdout.trim(),
      };
    } catch (err) {
      return { status: false, ping: 0, message: err instanceof Error ? err.message : String(err) };
    }
  }
}
