import { Injectable } from '@nestjs/common';
import mysql from 'mysql2/promise';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class MySqlStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    let connection: mysql.Connection | undefined;
    try {
      connection = await mysql.createConnection({
        host: config['host'] as string,
        port: config['port'] as number | undefined,
        database: config['database'] as string | undefined,
        user: config['username'] as string | undefined,
        password: config['password'] as string | undefined,
        connectTimeout: 10000,
      });
      const query = (config['query'] as string | undefined) || 'SELECT 1';
      await connection.query(query);
      const ping = Date.now() - start;
      return { status: true, ping, message: 'MySQL connection successful' };
    } catch (err) {
      return { status: false, ping: 0, message: err instanceof Error ? err.message : String(err) };
    } finally {
      try { await connection?.end(); } catch { /* ignore */ }
    }
  }
}
