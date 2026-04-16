import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EncryptionService } from '../../encryption/encryption.service.js';
import { NotificationStrategyRegistry } from './strategies/notification-strategy.registry.js';
import { NOTIFICATION_QUEUE } from '../../queue/queue.module.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { UpdateNotificationDto } from './dto/update-notification.dto.js';
import { AssignNotificationsDto } from './dto/assign-notifications.dto.js';
import type { NotificationResponseDto } from './dto/notification-response.dto.js';

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
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly registry: NotificationStrategyRegistry,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notifQueue: Queue,
  ) {}

  private encryptConfig(type: string, config: Record<string, unknown>): Record<string, unknown> {
    const fields = SENSITIVE_FIELDS[type] ?? [];
    const result = { ...config };
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.encryption.encrypt(result[field] as string);
      }
    }
    return result;
  }

  private decryptConfig(type: string, config: Record<string, unknown>): Record<string, unknown> {
    const fields = SENSITIVE_FIELDS[type] ?? [];
    const result = { ...config };
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        try {
          result[field] = this.encryption.decrypt(result[field] as string);
        } catch {
          this.logger.warn(`Failed to decrypt field ${field} for type ${type}`);
        }
      }
    }
    return result;
  }

  private redactConfig(type: string, config: Record<string, unknown>): Record<string, unknown> {
    const fields = SENSITIVE_FIELDS[type] ?? [];
    const result = { ...config };
    for (const field of fields) {
      if (result[field]) {
        result[field] = '***';
      }
    }
    return result;
  }

  private toResponse(notification: {
    id: number;
    userId: number;
    name: string;
    type: string;
    config: unknown;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      name: notification.name,
      type: notification.type,
      config: this.redactConfig(notification.type, notification.config as Record<string, unknown>),
      isDefault: notification.isDefault,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }

  async findAll(userId: number, role?: string): Promise<NotificationResponseDto[]> {
    const where = role === 'ADMIN' ? {} : { userId };
    const notifications = await this.prisma.notification.findMany({ where });
    return notifications.map((n) => this.toResponse(n));
  }

  async findOne(id: number, userId: number, role?: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    if (role !== 'ADMIN' && notification.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return this.toResponse(notification);
  }

  async create(userId: number, dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    const encryptedConfig = this.encryptConfig(dto.type, dto.config);
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        config: encryptedConfig as Prisma.InputJsonValue,
        isDefault: dto.isDefault ?? false,
      },
    });
    return this.toResponse(notification);
  }

  async update(id: number, userId: number, dto: UpdateNotificationDto, role?: string): Promise<NotificationResponseDto> {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Notification ${id} not found`);
    if (role !== 'ADMIN' && existing.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const type = dto.type ?? existing.type;
    const config = dto.config
      ? this.encryptConfig(type, dto.config)
      : undefined;

    const notification = await this.prisma.notification.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(config !== undefined && { config: config as Prisma.InputJsonValue }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
    return this.toResponse(notification);
  }

  async remove(id: number, userId: number, role?: string): Promise<void> {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Notification ${id} not found`);
    if (role !== 'ADMIN' && existing.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    await this.prisma.notification.delete({ where: { id } });
  }

  async sendTest(id: number, userId: number, role?: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    if (role !== 'ADMIN' && notification.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const config = this.decryptConfig(notification.type, notification.config as Record<string, unknown>);
    const strategy = this.registry.getStrategy(notification.type);

    await strategy.send(config, {
      monitorName: 'Test Monitor',
      monitorId: 0,
      status: true,
      previousStatus: null,
      message: 'This is a test notification from Uptime Pro.',
      ping: 42,
      timestamp: new Date().toISOString(),
    });
  }

  async sendTestDirect(type: string, config: Record<string, unknown>): Promise<void> {
    const strategy = this.registry.getStrategy(type);
    await strategy.send(config, {
      monitorName: 'Test Monitor',
      monitorId: 0,
      status: true,
      previousStatus: null,
      message: 'This is a test notification from Uptime Pro.',
      ping: 42,
      timestamp: new Date().toISOString(),
    });
  }

  async getMonitorNotifications(monitorId: number, userId: number, role?: string): Promise<number[]> {
    const monitor = await this.prisma.monitor.findUnique({ where: { id: monitorId } });
    if (!monitor) throw new NotFoundException(`Monitor ${monitorId} not found`);
    if (role !== 'ADMIN' && monitor.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const records = await this.prisma.monitorNotification.findMany({
      where: { monitorId },
    });
    return records.map((r) => r.notificationId);
  }

  async assignNotifications(monitorId: number, userId: number, dto: AssignNotificationsDto, role?: string): Promise<number[]> {
    const monitor = await this.prisma.monitor.findUnique({ where: { id: monitorId } });
    if (!monitor) throw new NotFoundException(`Monitor ${monitorId} not found`);
    if (role !== 'ADMIN' && monitor.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (dto.notificationIds.length > 0) {
      const notifications = await this.prisma.notification.findMany({
        where: { id: { in: dto.notificationIds } },
      });
      if (notifications.length !== dto.notificationIds.length) {
        throw new NotFoundException('One or more notifications not found');
      }
      if (role !== 'ADMIN') {
        const unauthorized = notifications.some((n) => n.userId !== userId);
        if (unauthorized) throw new ForbiddenException('Access denied to one or more notifications');
      }
    }

    await this.prisma.$transaction([
      this.prisma.monitorNotification.deleteMany({ where: { monitorId } }),
      ...dto.notificationIds.map((notificationId) =>
        this.prisma.monitorNotification.create({ data: { monitorId, notificationId } }),
      ),
    ]);

    return dto.notificationIds;
  }

  async dispatchThresholdAlert(monitor: { id: number; userId: number; resendInterval: number; lastAlertAt: Date | null; name: string }, responseTimeMs: number): Promise<void> {
    const throttleMs = (monitor.resendInterval > 0 ? monitor.resendInterval : 60) * 1000;
    if (monitor.lastAlertAt && Date.now() - monitor.lastAlertAt.getTime() < throttleMs) return;

    const monitorNotifications = await this.prisma.monitorNotification.findMany({ where: { monitorId: monitor.id } });
    if (monitorNotifications.length === 0) return;

    await this.prisma.monitor.update({ where: { id: monitor.id }, data: { lastAlertAt: new Date() } });

    const timestamp = new Date().toISOString();
    for (const mn of monitorNotifications) {
      try {
        await this.notifQueue.add('send-notification', {
          notificationId: mn.notificationId,
          monitorId: monitor.id,
          userId: monitor.userId,
          alertType: 'response_time_threshold',
          responseTimeMs,
          message: `Response time ${responseTimeMs}ms exceeded threshold`,
          timestamp,
        });
      } catch (err) {
        this.logger.warn(`Failed to enqueue threshold alert ${mn.notificationId}: ${err}`);
      }
    }
  }

  async dispatchForStatusChange(
    monitorId: number,
    userId: number,
    status: boolean,
    previousStatus: boolean | null,
    ping: number | null,
    message: string,
  ): Promise<void> {
    const monitor = await this.prisma.monitor.findUnique({ where: { id: monitorId } });
    if (!monitor) return;

    const statusChanged = previousStatus !== status;
    const isStillDown = !status && previousStatus === false;

    let shouldDispatch = false;

    if (statusChanged) {
      shouldDispatch = true;
    } else if (isStillDown && monitor.resendInterval > 0) {
      const lastAlert = monitor.lastAlertAt;
      if (!lastAlert || Date.now() - lastAlert.getTime() >= monitor.resendInterval * 1000) {
        shouldDispatch = true;
      }
    }

    if (!shouldDispatch) return;

    const monitorNotifications = await this.prisma.monitorNotification.findMany({
      where: { monitorId },
    });
    if (monitorNotifications.length === 0) return;

    await this.prisma.monitor.update({
      where: { id: monitorId },
      data: { lastAlertAt: new Date() },
    });

    const timestamp = new Date().toISOString();
    for (const mn of monitorNotifications) {
      try {
        await this.notifQueue.add('send-notification', {
          notificationId: mn.notificationId,
          monitorId,
          userId,
          status,
          previousStatus,
          ping,
          message,
          timestamp,
        });
      } catch (err) {
        this.logger.warn(`Failed to enqueue notification ${mn.notificationId}: ${err}`);
      }
    }
  }
}
