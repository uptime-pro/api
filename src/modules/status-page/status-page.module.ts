import { Module } from '@nestjs/common';
import { StatusPageController } from './status-page.controller.js';
import { StatusPageService } from './status-page.service.js';
import { SubscriberService } from './subscriber.service.js';

@Module({
  controllers: [StatusPageController],
  providers: [StatusPageService, SubscriberService],
  exports: [StatusPageService, SubscriberService],
})
export class StatusPageModule {}
