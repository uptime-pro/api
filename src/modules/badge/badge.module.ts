import { Module } from '@nestjs/common';
import { BadgeController } from './badge.controller.js';
import { BadgeService } from './badge.service.js';

@Module({
  controllers: [BadgeController],
  providers: [BadgeService],
})
export class BadgeModule {}
