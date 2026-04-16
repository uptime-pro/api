import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { MonitorResponseDto } from './dto/monitor-response.dto.js';
import { HeartbeatResponseDto } from './dto/heartbeat-response.dto.js';
import { MonitorExportDto } from './dto/monitor-export.dto.js';
import { MonitorImportDto, MonitorImportResultDto } from './dto/monitor-import.dto.js';
import { SlaStatsDto } from './dto/sla-stats.dto.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { RolesGuard } from '../../guards/roles.guard.js';
import { Roles } from '../../decorators/roles.decorator.js';
import { CurrentUser } from '../../decorators/current-user.decorator.js';
import type { JwtPayload } from '../../decorators/current-user.decorator.js';
import { MonitorService } from './monitor.service.js';
import { CreateMonitorDto } from './dto/create-monitor.dto.js';
import { UpdateMonitorDto } from './dto/update-monitor.dto.js';
import { HeartbeatQueryDto } from './dto/heartbeat-query.dto.js';

@ApiTags('monitors')
@Controller('monitors')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List all monitors for current user' })
  @ApiOkResponse({ type: [MonitorResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.monitorService.findAll(user.sub, user.role);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Export all monitors as JSON' })
  @ApiOkResponse({ type: MonitorExportDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  exportMonitors(@CurrentUser() user: JwtPayload) {
    return this.monitorService.exportMonitors(user.sub);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Import monitors from JSON' })
  @ApiCreatedResponse({ type: MonitorImportResultDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  importMonitors(@CurrentUser() user: JwtPayload, @Body() dto: MonitorImportDto) {
    return this.monitorService.importMonitors(user.sub, dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Create a new monitor' })
  @ApiCreatedResponse({ type: MonitorResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMonitorDto) {
    return this.monitorService.create(user.sub, dto);
  }

  @Post('push/:token')
  @ApiOperation({ summary: 'Receive a push heartbeat (no auth)' })
  @ApiOkResponse({ description: 'Heartbeat accepted' })
  @ApiNotFoundResponse({ description: 'Push token not found' })
  @HttpCode(HttpStatus.OK)
  handlePush(@Param('token') token: string) {
    return this.monitorService.handlePushHeartbeat(token);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get monitor by ID' })
  @ApiOkResponse({ type: MonitorResponseDto })
  @ApiNotFoundResponse({ description: 'Monitor not found' })
  @ApiForbiddenResponse({ description: 'Not your monitor' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.monitorService.findOne(id, user.sub, user.role);
  }

  @Get(':id/sla')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get SLA statistics for a monitor' })
  @ApiOkResponse({ type: SlaStatsDto })
  @ApiNotFoundResponse({ description: 'Monitor not found' })
  @ApiForbiddenResponse({ description: 'Not your monitor' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getSlaStats(
    @Param('id', ParseIntPipe) id: number,
    @Query('days') days: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.monitorService.getSlaStats(id, user.sub, days ? parseInt(days, 10) : 30, user.role);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Update monitor' })
  @ApiOkResponse({ type: MonitorResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiNotFoundResponse({ description: 'Monitor not found' })
  @ApiForbiddenResponse({ description: 'Not your monitor' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMonitorDto, @CurrentUser() user: JwtPayload) {
    return this.monitorService.update(id, user.sub, dto, user.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Delete monitor' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Monitor deleted' })
  @ApiNotFoundResponse({ description: 'Monitor not found' })
  @ApiForbiddenResponse({ description: 'Not your monitor' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.monitorService.remove(id, user.sub, user.role);
  }

  @Post(':id/pause')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiCookieAuth('access_token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause monitor' })
  @ApiOkResponse({ type: MonitorResponseDto })
  @ApiNotFoundResponse({ description: 'Monitor not found' })
  @ApiForbiddenResponse({ description: 'Not your monitor' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  pause(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.monitorService.pause(id, user.sub, user.role);
  }

  @Post(':id/resume')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiCookieAuth('access_token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume monitor' })
  @ApiOkResponse({ type: MonitorResponseDto })
  @ApiNotFoundResponse({ description: 'Monitor not found' })
  @ApiForbiddenResponse({ description: 'Not your monitor' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  resume(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.monitorService.resume(id, user.sub, user.role);
  }

  @Post(':id/check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiCookieAuth('access_token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger immediate check' })
  @ApiOkResponse({ description: 'Check triggered' })
  @ApiNotFoundResponse({ description: 'Monitor not found' })
  @ApiForbiddenResponse({ description: 'Not your monitor' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  manualCheck(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.monitorService.manualCheck(id, user.sub, user.role);
  }

  @Get(':id/heartbeats')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get heartbeat history' })
  @ApiOkResponse({ type: [HeartbeatResponseDto] })
  @ApiNotFoundResponse({ description: 'Monitor not found' })
  @ApiForbiddenResponse({ description: 'Not your monitor' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  getHeartbeats(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: HeartbeatQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.monitorService.getHeartbeats(id, user.sub, query, user.role);
  }

  @Delete(':id/heartbeats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiCookieAuth('access_token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete all heartbeats for monitor' })
  @ApiOkResponse({ description: 'Heartbeats deleted' })
  @ApiNotFoundResponse({ description: 'Monitor not found' })
  @ApiForbiddenResponse({ description: 'Not your monitor' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  deleteHeartbeats(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.monitorService.deleteHeartbeats(id, user.sub, user.role);
  }
}

