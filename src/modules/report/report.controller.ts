import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { RolesGuard } from '../../guards/roles.guard.js';
import { Roles } from '../../decorators/roles.decorator.js';
import { CurrentUser } from '../../decorators/current-user.decorator.js';
import type { JwtPayload } from '../../decorators/current-user.decorator.js';
import { ReportService } from './report.service.js';
import { UpdateReportConfigDto } from './dto/update-report-config.dto.js';
import { ReportConfigDto } from './dto/report-config.dto.js';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiCookieAuth('access_token')
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Admin only' })
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get report configuration' })
  @ApiOkResponse({ type: ReportConfigDto })
  getConfig(): Promise<ReportConfigDto> {
    return this.reportService.getReportConfig();
  }

  @Patch('config')
  @ApiOperation({ summary: 'Update report configuration' })
  @ApiOkResponse({ type: ReportConfigDto })
  updateConfig(
    @Body() dto: UpdateReportConfigDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReportConfigDto> {
    return this.reportService.updateReportConfig(dto, user.sub);
  }
}
