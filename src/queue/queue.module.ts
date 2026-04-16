import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const MONITOR_QUEUE = 'monitor-checks';
export const NOTIFICATION_QUEUE = 'notification-dispatch';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: new URL(config.get('DRAGONFLY_URL', 'redis://localhost:6379')).hostname,
          port: parseInt(new URL(config.get('DRAGONFLY_URL', 'redis://localhost:6379')).port || '6379'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
