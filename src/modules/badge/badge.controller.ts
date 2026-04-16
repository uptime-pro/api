import { Controller, Get, Param, ParseIntPipe, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { BadgeService } from './badge.service.js';

@ApiTags('badge')
@Controller('badge')
export class BadgeController {
  constructor(private readonly badgeService: BadgeService) {}

  @Get(':id/status')
  @ApiOperation({ summary: 'Get status badge SVG for a monitor' })
  async statusBadge(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const svg = await this.badgeService.getStatusBadge(id);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(svg);
  }

  @Get(':id/uptime')
  @ApiOperation({ summary: 'Get uptime badge SVG for a monitor (30-day)' })
  async uptimeBadge(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const svg = await this.badgeService.getUptimeBadge(id);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(svg);
  }
}
