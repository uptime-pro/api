import { PartialType } from '@nestjs/swagger';
import { CreateMonitorDto } from './create-monitor.dto.js';

export class UpdateMonitorDto extends PartialType(CreateMonitorDto) {}
