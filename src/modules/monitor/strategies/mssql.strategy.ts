import { Injectable } from '@nestjs/common';
import mssql from 'mssql';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class MssqlStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    let pool: mssql.ConnectionPool | undefined;
    try {
      pool = await mssql.connect({
        server: config['server'] as string,
        port: config['port'] as number | undefined,
        database: config['database'] as string | undefined,
        user: config['username'] as string | undefined,
        password: config['password'] as string | undefined,
        options: {
          trustServerCertificate: true,
          connectTimeout: 10000,
        },
      });
      await pool.request().query('SELECT 1');
      const ping = Date.now() - start;
      return { status: true, ping, message: 'MSSQL connection successful' };
    } catch (err) {
      return { status: false, ping: 0, message: err instanceof Error ? err.message : String(err) };
    } finally {
      try { await pool?.close(); } catch { /* ignore */ }
    }
  }
}
