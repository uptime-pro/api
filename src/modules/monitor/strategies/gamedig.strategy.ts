import { Injectable } from '@nestjs/common';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class GamedigStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    try {
      // Dynamic import to handle module resolution differences
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gamedigModule = await import('gamedig') as any;
      const GameDig = gamedigModule.GameDig ?? gamedigModule.default;
      const state = await GameDig.query({
        type: config['type'] as string,
        host: config['host'] as string,
        port: config['port'] as number | undefined,
        maxAttempts: 1,
        socketTimeout: 9000,
      });
      const ping = Math.round(state.ping ?? (Date.now() - start));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { status: true, ping, message: `Players: ${(state.players as any[])?.length ?? 0}/${state.maxplayers ?? '?'}` };
    } catch (err) {
      return { status: false, ping: 0, message: err instanceof Error ? err.message : String(err) };
    }
  }
}
