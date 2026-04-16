import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { MONITOR_QUEUE, NOTIFICATION_QUEUE } from '../../queue/queue.module.js';

@Injectable()
export class InfrastructureService {
  constructor(
    @InjectQueue(MONITOR_QUEUE) private readonly monitorQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async getQueueStats() {
    const [monitorCounts, notificationCounts, monitorWorkers, notificationWorkers] =
      await Promise.all([
        this.monitorQueue.getJobCounts(
          'waiting', 'active', 'completed', 'failed', 'delayed', 'paused',
        ),
        this.notificationQueue.getJobCounts(
          'waiting', 'active', 'completed', 'failed', 'delayed', 'paused',
        ),
        this.monitorQueue.getWorkers(),
        this.notificationQueue.getWorkers(),
      ]);

    return [
      {
        name: MONITOR_QUEUE,
        displayName: 'Monitor Checks',
        counts: monitorCounts,
        workerCount: monitorWorkers.length,
      },
      {
        name: NOTIFICATION_QUEUE,
        displayName: 'Notification Dispatch',
        counts: notificationCounts,
        workerCount: notificationWorkers.length,
      },
    ];
  }

  async getDragonflyInfo() {
    const url = this.config.get('DRAGONFLY_URL', 'redis://localhost:6379');
    const parsed = new URL(url);
    const redis = new Redis({
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379'),
      password: parsed.password || undefined,
      lazyConnect: true,
      connectTimeout: 5000,
    });
    try {
      await redis.connect();
      const [info, dbSize] = await Promise.all([redis.info(), redis.dbsize()]);

      const fields: Record<string, string> = {};
      for (const line of info.split('\r\n')) {
        if (line && !line.startsWith('#')) {
          const idx = line.indexOf(':');
          if (idx !== -1) fields[line.slice(0, idx)] = line.slice(idx + 1);
        }
      }

      return {
        status: 'connected' as const,
        version: fields['dragonfly_version'] ?? fields['redis_version'] ?? 'unknown',
        uptimeSeconds: parseInt(fields['uptime_in_seconds'] ?? '0', 10),
        connectedClients: parseInt(fields['connected_clients'] ?? '0', 10),
        usedMemoryHuman: fields['used_memory_human'] ?? '0B',
        usedMemoryRssHuman: fields['used_memory_rss_human'] ?? '0B',
        totalCommandsProcessed: parseInt(fields['total_commands_processed'] ?? '0', 10),
        keyspaceHits: parseInt(fields['keyspace_hits'] ?? '0', 10),
        keyspaceMisses: parseInt(fields['keyspace_misses'] ?? '0', 10),
        dbSize,
        role: fields['role'] ?? 'master',
      };
    } catch (err) {
      return {
        status: 'error' as const,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      try { redis.disconnect(); } catch { /* ignore */ }
    }
  }

  async getPostgresStats() {
    const connectionString = this.config.get<string>('DATABASE_URL');
    const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000 });
    const client = await pool.connect();
    try {
      const [dbRow, activityRow, tableRow, pgVersion] = await Promise.all([
        client.query<{
          db_size: string; numbackends: string; xact_commit: string;
          xact_rollback: string; blks_read: string; blks_hit: string;
          deadlocks: string; conflicts: string; temp_bytes: string;
        }>(`
          SELECT
            pg_size_pretty(pg_database_size(current_database())) AS db_size,
            numbackends, xact_commit, xact_rollback,
            blks_read, blks_hit, deadlocks, conflicts, temp_bytes
          FROM pg_stat_database
          WHERE datname = current_database()
        `),
        client.query<{ active: string; idle: string; idle_in_transaction: string; waiting: string }>(`
          SELECT
            COUNT(*) FILTER (WHERE state = 'active') AS active,
            COUNT(*) FILTER (WHERE state = 'idle') AS idle,
            COUNT(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
            COUNT(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting
          FROM pg_stat_activity
          WHERE datname = current_database()
        `),
        client.query<{ table_count: string; total_rows: string; dead_rows: string; index_count: string }>(`
          SELECT
            COUNT(*) AS table_count,
            COALESCE(SUM(n_live_tup), 0) AS total_rows,
            COALESCE(SUM(n_dead_tup), 0) AS dead_rows,
            (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') AS index_count
          FROM pg_stat_user_tables
          WHERE schemaname = 'public'
        `),
        client.query<{ version: string }>(`SELECT version()`),
      ]);

      const db = dbRow.rows[0];
      const activity = activityRow.rows[0];
      const tables = tableRow.rows[0];

      const blksRead = parseInt(db.blks_read ?? '0', 10);
      const blksHit = parseInt(db.blks_hit ?? '0', 10);
      const cacheHitRate = blksRead + blksHit > 0
        ? Math.round((blksHit / (blksRead + blksHit)) * 100)
        : 100;

      const versionFull = pgVersion.rows[0]?.version ?? '';
      const versionShort = versionFull.match(/PostgreSQL (\d+\.\d+)/)?.[1] ?? versionFull;

      return {
        status: 'connected' as const,
        version: versionShort,
        databaseSize: db.db_size,
        connections: {
          active: parseInt(activity.active ?? '0', 10),
          idle: parseInt(activity.idle ?? '0', 10),
          idleInTransaction: parseInt(activity.idle_in_transaction ?? '0', 10),
          waiting: parseInt(activity.waiting ?? '0', 10),
        },
        transactions: {
          committed: parseInt(db.xact_commit ?? '0', 10),
          rolledBack: parseInt(db.xact_rollback ?? '0', 10),
        },
        cacheHitRate,
        deadlocks: parseInt(db.deadlocks ?? '0', 10),
        conflicts: parseInt(db.conflicts ?? '0', 10),
        tables: {
          count: parseInt(tables.table_count ?? '0', 10),
          totalRows: parseInt(tables.total_rows ?? '0', 10),
          deadRows: parseInt(tables.dead_rows ?? '0', 10),
          indexCount: parseInt(tables.index_count ?? '0', 10),
        },
      };
    } catch (err) {
      return {
        status: 'error' as const,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      client.release();
      await pool.end();
    }
  }
}
