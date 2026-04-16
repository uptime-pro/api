import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
import { StatusPageService } from './status-page.service.js';
import { SubscriberService } from './subscriber.service.js';
import { CreateStatusPageDto } from './dto/create-status-page.dto.js';
import { UpdateStatusPageDto } from './dto/update-status-page.dto.js';
import { StatusPageResponseDto } from './dto/status-page-response.dto.js';
import { SetStatusPageMonitorsDto } from './dto/set-monitors.dto.js';
import { SubscribeDto } from './dto/subscribe.dto.js';

@ApiTags('status-pages')
@Controller()
export class StatusPageController {
  constructor(
    private readonly statusPageService: StatusPageService,
    private readonly subscriberService: SubscriberService,
  ) {}

  @Get('status-pages')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List all status pages for current user' })
  @ApiOkResponse({ type: [StatusPageResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.statusPageService.findAll(user.sub, user.role);
  }

  @Post('status-pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Create a new status page' })
  @ApiCreatedResponse({ type: StatusPageResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateStatusPageDto) {
    return this.statusPageService.create(user.sub, dto);
  }

  @Get('status-pages/:id')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get a status page by ID' })
  @ApiOkResponse({ type: StatusPageResponseDto })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.statusPageService.findOne(id, user.sub, user.role);
  }

  @Patch('status-pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Update a status page' })
  @ApiOkResponse({ type: StatusPageResponseDto })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusPageDto,
  ) {
    return this.statusPageService.update(id, user.sub, dto, user.role);
  }

  @Delete('status-pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiCookieAuth('access_token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a status page' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.statusPageService.remove(id, user.sub, user.role);
  }

  @Put('status-pages/:id/monitors')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Replace monitors on a status page' })
  @ApiOkResponse({ description: 'Monitors updated' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiBadRequestResponse({ description: 'Invalid monitor IDs' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  setMonitors(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetStatusPageMonitorsDto,
  ) {
    return this.statusPageService.setMonitors(id, user.sub, dto, user.role);
  }

  @Get('status-pages/:id/monitors')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get monitors for a status page' })
  @ApiOkResponse({ description: 'List of monitors' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  getMonitors(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.statusPageService.getMonitors(id, user.sub, user.role);
  }

  @Post('status-pages/:id/subscribe')
  @ApiOperation({ summary: 'Subscribe to status page notifications' })
  @ApiCreatedResponse({ description: 'Subscribed successfully' })
  @ApiBadRequestResponse({ description: 'Email or webhookUrl required' })
  subscribe(@Param('id', ParseIntPipe) id: number, @Body() dto: SubscribeDto) {
    return this.subscriberService.subscribe(id, dto);
  }

  @Delete('subscribers/unsubscribe/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe from status page notifications' })
  unsubscribe(@Param('token') token: string) {
    return this.subscriberService.unsubscribe(token);
  }

  @Get('status/:slug')
  @ApiOperation({ summary: 'Get public status page data by slug' })
  @ApiOkResponse({ description: 'Public status page data' })
  @ApiNotFoundResponse({ description: 'Not found or not published' })
  async getPublicBySlug(@Param('slug') slug: string) {
    const data = await this.statusPageService.getPublicStatusPage(slug);
    if (!data) throw new NotFoundException('Status page not found');
    return data;
  }

  @Get('status/domain/:domain')
  @ApiOperation({ summary: 'Get public status page data by custom domain' })
  @ApiOkResponse({ description: 'Public status page data' })
  @ApiNotFoundResponse({ description: 'Not found or not published' })
  async getPublicByDomain(@Param('domain') domain: string) {
    const data = await this.statusPageService.getPublicStatusPageByDomain(domain);
    if (!data) throw new NotFoundException('Status page not found');
    return data;
  }
}
