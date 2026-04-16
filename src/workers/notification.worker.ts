import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { NOTIFICATION_QUEUE } from '../queue/queue.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationStrategyRegistry } from '../modules/notification/strategies/notification-strategy.registry.js';
import { EncryptionService } from '../encryption/encryption.service.js';
import type { NotificationPayload } from '../modules/notification/strategies/notification-strategy.interface.js';

const SENSITIVE_FIELDS: Record<string, string[]> = {
  discord: ['webhookUrl'],
  slack: ['webhookUrl'],
  teams: ['webhookUrl'],
  email: ['password'],
  telegram: ['botToken'],
  pushover: ['token', 'userKey'],
  gotify: ['token'],
  ntfy: ['authToken'],
  webhook: [],
};

@Injectable()
@Processor(NOTIFICATION_QUEUE)
export class NotificationWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: NotificationStrategyRegistry,
    private readonly encryption: EncryptionService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { notificationId, monitorId, status, previousStatus, ping, message, timestamp } = job.data as {
      notificationId: number;
      monitorId: number;
      status: boolean;
      previousStatus: boolean | null;
      ping: number | null;
      message: string;
      timestamp: string;
    };

    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) {
      this.logger.warn(`Notification ${notificationId} not found, skipping`);
      return;
    }

    const monitor = await this.prisma.monitor.findUnique({ where: { id: monitorId } });
    if (!monitor) {
      this.logger.warn(`Monitor ${monitorId} not found, skipping`);
      return;
    }

    const config = { ...(notification.config as Record<string, unknown>) };
    const sensitiveFields = SENSITIVE_FIELDS[notification.type] ?? [];
    for (const field of sensitiveFields) {
      if (config[field] && typeof config[field] === 'string') {
        try {
          config[field] = this.encryption.decrypt(config[field] as string);
        } catch {
          this.logger.warn(`Failed to decrypt field ${field} for notification ${notificationId}`);
        }
      }
    }

    const payload: NotificationPayload = {
      monitorName: monitor.name,
      monitorId,
      status,
      previousStatus,
      message,
      ping,
      timestamp,
    };

    const strategy = this.registry.getStrategy(notification.type);
    await strategy.send(config, payload);
    this.logger.log(`Notification ${notificationId} sent via ${notification.type} for monitor ${monitorId}`);
  }
}
