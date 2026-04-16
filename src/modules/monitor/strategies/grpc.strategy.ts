import { Injectable } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class GrpcStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    const channel = new grpc.Channel(
      config['url'] as string,
      grpc.credentials.createInsecure(),
      {},
    );
    try {
      await new Promise<void>((resolve, reject) => {
        const deadline = new Date(Date.now() + 8000);
        channel.watchConnectivityState(channel.getConnectivityState(true), deadline, (err) => {
          if (err) reject(err); else resolve();
        });
      });
      const ping = Date.now() - start;
      channel.close();
      return { status: true, ping, message: 'gRPC channel connected' };
    } catch (err) {
      channel.close();
      return { status: false, ping: 0, message: err instanceof Error ? err.message : String(err) };
    }
  }
}
