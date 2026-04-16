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
import { TagService } from './tag.service.js';
import { CreateTagDto } from './dto/create-tag.dto.js';
import { UpdateTagDto } from './dto/update-tag.dto.js';
import { TagResponseDto } from './dto/tag-response.dto.js';
import { SetMonitorTagsDto } from './dto/set-monitor-tags.dto.js';

@ApiTags('Tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @ApiOperation({ summary: 'List all tags for the current user' })
  @ApiResponse({ status: 200, type: [TagResponseDto] })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.tagService.findAll(user.sub);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a new tag' })
  @ApiResponse({ status: 201, type: TagResponseDto })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTagDto, @Req() req: Request) {
    return this.tagService.create(user.sub, dto, req.ip);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tag by ID' })
  @ApiResponse({ status: 200, type: TagResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.tagService.findOne(id, user.sub);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Update a tag' })
  @ApiResponse({ status: 200, type: TagResponseDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTagDto,
    @Req() req: Request,
  ) {
    return this.tagService.update(id, user.sub, dto, req.ip);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.tagService.delete(id, user.sub, req.ip);
  }

  @Put(':id/monitors')
  @UseGuards(RolesGuard)
  @Roles('EDITOR', 'ADMIN')
  @ApiOperation({ summary: 'Set monitors for a tag' })
  @ApiResponse({ status: 200, description: 'Updated monitor associations' })
  setMonitors(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetMonitorTagsDto,
    @Req() req: Request,
  ) {
    return this.tagService.setMonitors(id, user.sub, dto.monitorIds, req.ip);
  }

  @Get(':id/monitors')
  @ApiOperation({ summary: 'Get monitors for a tag' })
  @ApiResponse({ status: 200, description: 'List of monitors' })
  getMonitors(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.tagService.getMonitors(id, user.sub);
  }
}
