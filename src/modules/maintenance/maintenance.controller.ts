import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { RolesGuard } from '../../guards/roles.guard.js';
import { Roles } from '../../decorators/roles.decorator.js';
import { CurrentUser } from '../../decorators/current-user.decorator.js';
import type { JwtPayload } from '../../decorators/current-user.decorator.js';
import { MaintenanceService } from './maintenance.service.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto.js';
import { MaintenanceResponseDto } from './dto/maintenance-response.dto.js';
import { SetMonitorTagsDto } from '../tag/dto/set-monitor-tags.dto.js';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'List all maintenance windows' })
  @ApiResponse({ status: 200, type: [MaintenanceResponseDto] })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.maintenanceService.findAll(user.sub);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a maintenance window' })
  @ApiResponse({ status: 201, type: MaintenanceResponseDto })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMaintenanceDto, @Req() req: Request) {
    return this.maintenanceService.create(user.sub, dto, req.ip);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a maintenance window by ID' })
  @ApiResponse({ status: 200, type: MaintenanceResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.maintenanceService.findOne(id, user.sub);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Update a maintenance window' })
  @ApiResponse({ status: 200, type: MaintenanceResponseDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateMaintenanceDto,
    @Req() req: Request,
  ) {
    return this.maintenanceService.update(id, user.sub, dto, req.ip);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a maintenance window' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.maintenanceService.delete(id, user.sub, req.ip);
  }

  @Put(':id/monitors')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Set monitors for a maintenance window' })
  @ApiResponse({ status: 200, type: MaintenanceResponseDto })
  setMonitors(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetMonitorTagsDto,
    @Req() req: Request,
  ) {
    return this.maintenanceService.setMonitors(id, user.sub, dto.monitorIds, req.ip);
  }
}
