import { Injectable } from '@nestjs/common';
import { Client } from 'pg';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class PostgresStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    const client = new Client({
      host: config['host'] as string,
      port: config['port'] as number | undefined,
      database: config['database'] as string | undefined,
      user: config['username'] as string | undefined,
      password: config['password'] as string | undefined,
      connectionTimeoutMillis: 10000,
      query_timeout: 10000,
    });
    try {
      await client.connect();
      const query = (config['query'] as string | undefined) || 'SELECT 1';
      await client.query(query);
      const ping = Date.now() - start;
      return { status: true, ping, message: 'PostgreSQL connection successful' };
    } catch (err) {
      return { status: false, ping: 0, message: err instanceof Error ? err.message : String(err) };
    } finally {
      try { await client.end(); } catch { /* ignore */ }
    }
  }
}
