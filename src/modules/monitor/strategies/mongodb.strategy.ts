import { Injectable } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class MongoDbStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    const client = new MongoClient(config['connectionString'] as string, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    try {
      await client.connect();
      const db = client.db((config['database'] as string | undefined) || 'admin');
      await db.command({ ping: 1 });
      const ping = Date.now() - start;
      return { status: true, ping, message: 'MongoDB connection successful' };
    } catch (err) {
      return { status: false, ping: 0, message: err instanceof Error ? err.message : String(err) };
    } finally {
      try { await client.close(); } catch { /* ignore */ }
    }
  }
}
