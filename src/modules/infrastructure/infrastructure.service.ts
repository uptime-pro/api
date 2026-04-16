import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
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
}
