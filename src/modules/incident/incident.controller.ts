import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { RolesGuard } from '../../guards/roles.guard.js';
import { Roles } from '../../decorators/roles.decorator.js';
import { CurrentUser } from '../../decorators/current-user.decorator.js';
import type { JwtPayload } from '../../decorators/current-user.decorator.js';
import { IncidentService } from './incident.service.js';
import { CreateIncidentDto } from './dto/create-incident.dto.js';
import { UpdateIncidentDto } from './dto/update-incident.dto.js';
import { CreateIncidentUpdateDto } from './dto/create-incident-update.dto.js';
import { IncidentResponseDto } from './dto/incident-response.dto.js';

@ApiTags('incidents')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiCookieAuth('access_token')
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get('status-pages/:statusPageId/incidents')
  @ApiOperation({ summary: 'List incidents for a status page' })
  @ApiOkResponse({ type: [IncidentResponseDto] })
  @ApiNotFoundResponse({ description: 'Status page not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Param('statusPageId', ParseIntPipe) statusPageId: number,
  ) {
    return this.incidentService.findAll(statusPageId, user.sub, user.role);
  }

  @Post('status-pages/:statusPageId/incidents')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a new incident for a status page' })
  @ApiCreatedResponse({ type: IncidentResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiNotFoundResponse({ description: 'Status page not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('statusPageId', ParseIntPipe) statusPageId: number,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.incidentService.create(statusPageId, user.sub, dto, user.role);
  }

  @Get('incidents/:id')
  @ApiOperation({ summary: 'Get an incident with its updates' })
  @ApiOkResponse({ type: IncidentResponseDto })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.incidentService.findOne(id, user.sub, user.role);
  }

  @Patch('incidents/:id')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Update an incident' })
  @ApiOkResponse({ type: IncidentResponseDto })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.incidentService.update(id, user.sub, dto, user.role);
  }

  @Delete('incidents/:id')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an incident' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.incidentService.remove(id, user.sub, user.role);
  }

  @Post('incidents/:id/updates')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Add a timeline update to an incident' })
  @ApiCreatedResponse({ description: 'Update added' })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  addUpdate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateIncidentUpdateDto,
  ) {
    return this.incidentService.addUpdate(id, user.sub, dto, user.role);
  }
}
