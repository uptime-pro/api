import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { MONITOR_QUEUE } from '../queue/queue.module.js';
import { MonitorService } from '../modules/monitor/monitor.service.js';
import { MonitorStrategyRegistry } from '../modules/monitor/strategies/strategy.registry.js';
import { MaintenanceService } from '../modules/monitor/maintenance.service.js';
import { WsGateway } from '../modules/websocket/ws.gateway.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationService } from '../modules/notification/notification.service.js';

@Injectable()
@Processor(MONITOR_QUEUE)
export class MonitorWorker extends WorkerHost {
  private readonly logger = new Logger(MonitorWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitorService: MonitorService,
    private readonly registry: MonitorStrategyRegistry,
    private readonly maintenanceService: MaintenanceService,
    private readonly wsGateway: WsGateway,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<{ monitorId: number }>): Promise<void> {
    const { monitorId } = job.data;
    try {
      const monitor = await this.prisma.monitor.findUnique({
        where: { id: monitorId },
        include: { user: true },
      });
      if (!monitor || !monitor.active) return;

      const inMaintenance = await this.maintenanceService.isInMaintenance(monitorId);
      if (inMaintenance) {
        this.logger.debug(`Monitor ${monitorId} is in maintenance window, skipping check`);
        return;
      }

      const strategy = this.registry.getStrategy(monitor.type);
      const checkConfig =
        monitor.type === 'group'
          ? { ...(monitor.config as Record<string, unknown>), _monitorId: monitor.id }
          : (monitor.config as Record<string, unknown>);
      const result = await strategy.check(checkConfig);

      const { changed, previousStatus } = await this.monitorService.writeHeartbeat(monitorId, result);

      if (monitor.responseTimeThreshold && result.ping !== null && result.ping !== undefined) {
        if (result.ping > monitor.responseTimeThreshold) {
          try {
            await this.notificationService.dispatchThresholdAlert(monitor, result.ping);
          } catch (threshErr) {
            this.logger.warn(`Threshold alert failed for monitor ${monitorId}: ${threshErr}`);
          }
        }
      }

      const heartbeatEvent = {
        monitorId,
        status: result.status,
        ping: result.ping,
        msg: result.message,
        createdAt: new Date().toISOString(),
      };
      this.wsGateway.emitHeartbeat(monitor.userId, heartbeatEvent);

      if (changed) {
        this.wsGateway.emitMonitorStatus(monitor.userId, {
          monitorId,
          status: result.status,
          previousStatus,
          ping: result.ping,
          msg: result.message,
          createdAt: new Date().toISOString(),
        });
      }

      try {
        await this.notificationService.dispatchForStatusChange(
          monitorId,
          monitor.userId,
          result.status,
          previousStatus,
          result.ping,
          result.message,
        );
      } catch (notifErr) {
        this.logger.warn(`Notification dispatch failed for monitor ${monitorId}: ${notifErr}`);
      }
    } catch (err) {
      this.logger.error(`Worker error for monitor ${monitorId}: ${err}`);
      try {
        const monitor = await this.prisma.monitor.findUnique({ where: { id: monitorId } });
        if (monitor) {
          const { changed, previousStatus } = await this.monitorService.writeHeartbeat(monitorId, {
            status: false,
            ping: 0,
            message: `Error: ${err instanceof Error ? err.message : String(err)}`,
          });
          if (changed) {
            this.wsGateway.emitMonitorStatus(monitor.userId, {
              monitorId,
              status: false,
              previousStatus,
              ping: 0,
              msg: `Error: ${err instanceof Error ? err.message : String(err)}`,
              createdAt: new Date().toISOString(),
            });
          }
          try {
            await this.notificationService.dispatchForStatusChange(
              monitorId,
              monitor.userId,
              false,
              previousStatus,
              0,
              `Error: ${err instanceof Error ? err.message : String(err)}`,
            );
          } catch (notifErr) {
            this.logger.warn(`Notification dispatch failed for monitor ${monitorId}: ${notifErr}`);
          }
        }
      } catch (writeErr) {
        this.logger.error(`Failed to write error heartbeat: ${writeErr}`);
      }
    }
  }
}

