import { PartialType } from '@nestjs/swagger';
import { CreateMaintenanceDto } from './create-maintenance.dto.js';

export class UpdateMaintenanceDto extends PartialType(CreateMaintenanceDto) {}
