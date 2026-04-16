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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { RolesGuard } from '../../guards/roles.guard.js';
import { Roles } from '../../decorators/roles.decorator.js';
import { CurrentUser } from '../../decorators/current-user.decorator.js';
import { NotificationService } from './notification.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { UpdateNotificationDto } from './dto/update-notification.dto.js';
import { AssignNotificationsDto } from './dto/assign-notifications.dto.js';
import { NotificationResponseDto } from './dto/notification-response.dto.js';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'List all notifications for the current user' })
  @ApiResponse({ status: 200, description: 'List of notifications', type: [NotificationResponseDto] })
  findAll(@CurrentUser() user: { sub: number; role: string }) {
    return this.notificationService.findAll(user.sub, user.role);
  }

  @Post('notifications')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a new notification channel' })
  @ApiResponse({ status: 201, description: 'Created notification', type: NotificationResponseDto })
  create(
    @CurrentUser() user: { sub: number; role: string },
    @Body() dto: CreateNotificationDto,
  ) {
    return this.notificationService.create(user.sub, dto);
  }

  @Get('notifications/monitor/:monitorId')
  @ApiOperation({ summary: 'Get notification IDs assigned to a monitor' })
  @ApiResponse({ status: 200, description: 'List of notification IDs', type: [Number] })
  getMonitorNotifications(
    @Param('monitorId', ParseIntPipe) monitorId: number,
    @CurrentUser() user: { sub: number; role: string },
  ) {
    return this.notificationService.getMonitorNotifications(monitorId, user.sub, user.role);
  }

  @Put('notifications/monitor/:monitorId')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Replace all notifications assigned to a monitor' })
  @ApiResponse({ status: 200, description: 'Updated notification IDs', type: [Number] })
  assignNotifications(
    @Param('monitorId', ParseIntPipe) monitorId: number,
    @CurrentUser() user: { sub: number; role: string },
    @Body() dto: AssignNotificationsDto,
  ) {
    return this.notificationService.assignNotifications(monitorId, user.sub, dto, user.role);
  }

  @Get('notifications/:id')
  @ApiOperation({ summary: 'Get a notification by ID' })
  @ApiResponse({ status: 200, description: 'Notification details', type: NotificationResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { sub: number; role: string },
  ) {
    return this.notificationService.findOne(id, user.sub, user.role);
  }

  @Patch('notifications/:id')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Update a notification channel' })
  @ApiResponse({ status: 200, description: 'Updated notification', type: NotificationResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { sub: number; role: string },
    @Body() dto: UpdateNotificationDto,
  ) {
    return this.notificationService.update(id, user.sub, dto, user.role);
  }

  @Delete('notifications/:id')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification channel' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { sub: number; role: string },
  ) {
    return this.notificationService.remove(id, user.sub, user.role);
  }

  @Post('notifications/:id/test')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send a test notification' })
  @ApiResponse({ status: 204, description: 'Test sent' })
  @ApiResponse({ status: 404, description: 'Not found' })
  sendTest(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { sub: number; role: string },
  ) {
    return this.notificationService.sendTest(id, user.sub, user.role);
  }
}
