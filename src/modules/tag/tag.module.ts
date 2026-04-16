import { Module } from '@nestjs/common';
import { TagService } from './tag.service.js';
import { TagController } from './tag.controller.js';
import { AuditModule } from '../../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
