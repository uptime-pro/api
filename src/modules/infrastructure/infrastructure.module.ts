import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule, MONITOR_QUEUE, NOTIFICATION_QUEUE } from '../../queue/queue.module.js';
import { InfrastructureController } from './infrastructure.controller.js';
import { InfrastructureService } from './infrastructure.service.js';

@Module({
  imports: [
    QueueModule,
    BullModule.registerQueue({ name: MONITOR_QUEUE }),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  controllers: [InfrastructureController],
  providers: [InfrastructureService],
})
export class InfrastructureModule {}
