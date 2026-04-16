import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportController } from './report.controller.js';
import { ReportService } from './report.service.js';
import { AuditModule } from '../../audit/audit.module.js';

@Module({
  imports: [ScheduleModule.forRoot(), AuditModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
