import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InfrastructureService } from './infrastructure.service.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { RolesGuard } from '../../guards/roles.guard.js';
import { Roles } from '../../decorators/roles.decorator.js';

@ApiTags('infrastructure')
@Controller('infrastructure')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class InfrastructureController {
  constructor(private readonly service: InfrastructureService) {}

  @Get('queues')
  @ApiOperation({ summary: 'Get BullMQ queue job counts and worker info' })
  getQueues() {
    return this.service.getQueueStats();
  }

  @Get('dragonfly')
  @ApiOperation({ summary: 'Get DragonflyDB status and metrics' })
  getDragonfly() {
    return this.service.getDragonflyInfo();
  }
}
