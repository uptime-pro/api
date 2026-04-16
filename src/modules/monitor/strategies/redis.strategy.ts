import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class RedisStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    const redis = new Redis({
      host: config['host'] as string,
      port: (config['port'] as number | undefined) || 6379,
      password: config['password'] as string | undefined,
      db: config['database'] as number | undefined,
      lazyConnect: true,
      connectTimeout: 10000,
      enableOfflineQueue: false,
    });
    try {
      await redis.connect();
      await redis.ping();
      const ping = Date.now() - start;
      return { status: true, ping, message: 'Redis connection successful' };
    } catch (err) {
      return { status: false, ping: 0, message: err instanceof Error ? err.message : String(err) };
    } finally {
      try { redis.disconnect(); } catch { /* ignore */ }
    }
  }
}
