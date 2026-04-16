import { Module } from '@nestjs/common';
import { IncidentController } from './incident.controller.js';
import { IncidentService } from './incident.service.js';
import { StatusPageModule } from '../status-page/status-page.module.js';

@Module({
  imports: [StatusPageModule],
  controllers: [IncidentController],
  providers: [IncidentService],
  exports: [IncidentService],
})
export class IncidentModule {}
