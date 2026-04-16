import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { CurrentUser } from '../../decorators/current-user.decorator.js';
import type { JwtPayload } from '../../decorators/current-user.decorator.js';
import { ApiKeyService } from './api-key.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { ApiKeyResponseDto, ApiKeyCreatedResponseDto } from './dto/api-key-response.dto.js';

@ApiTags('api-keys')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @ApiOperation({ summary: 'List user API keys' })
  @ApiOkResponse({ type: [ApiKeyResponseDto] })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.apiKeyService.findAll(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create API key (key shown once)' })
  @ApiCreatedResponse({ type: ApiKeyCreatedResponseDto })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateApiKeyDto, @Req() req: Request) {
    return this.apiKeyService.create(user.sub, dto, req.ip);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke API key' })
  @ApiOkResponse({ description: 'Key revoked' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.apiKeyService.remove(id, user.sub, req.ip);
  }
}
