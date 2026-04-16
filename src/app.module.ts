import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { QueueModule, MONITOR_QUEUE, NOTIFICATION_QUEUE } from './queue/queue.module.js';
import { MonitorModule } from './modules/monitor/monitor.module.js';
import { NotificationModule } from './modules/notification/notification.module.js';
import { StatusPageModule } from './modules/status-page/status-page.module.js';
import { IncidentModule } from './modules/incident/incident.module.js';
import { TagModule } from './modules/tag/tag.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { MaintenanceModule } from './modules/maintenance/maintenance.module.js';
import { ApiKeyModule } from './modules/api-key/api-key.module.js';
import { MetricsModule } from './modules/metrics/metrics.module.js';
import { BadgeModule } from './modules/badge/badge.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ReportModule } from './modules/report/report.module.js';
import { AdminQueueMiddleware } from './middleware/admin-queue.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UserModule,
    QueueModule,
    MonitorModule,
    NotificationModule,
    StatusPageModule,
    IncidentModule,
    TagModule,
    SettingsModule,
    MaintenanceModule,
    ApiKeyModule,
    MetricsModule,
    BadgeModule,
    HealthModule,
    ReportModule,
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: MONITOR_QUEUE,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: NOTIFICATION_QUEUE,
      adapter: BullMQAdapter,
    }),
  ],
  providers: [AdminQueueMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AdminQueueMiddleware).forRoutes('/admin/queues');
  }
}
