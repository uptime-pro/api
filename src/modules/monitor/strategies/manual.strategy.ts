import { Injectable } from '@nestjs/common';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class ManualStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    return { status: config['status'] !== false, ping: 0, message: 'Manual monitor' };
  }
}
