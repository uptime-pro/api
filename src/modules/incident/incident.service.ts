import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SubscriberService } from '../status-page/subscriber.service.js';
import type { CreateIncidentDto } from './dto/create-incident.dto.js';
import type { UpdateIncidentDto } from './dto/update-incident.dto.js';
import type { CreateIncidentUpdateDto } from './dto/create-incident-update.dto.js';

@Injectable()
export class IncidentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriberService: SubscriberService,
  ) {}

  private async _verifyStatusPageOwnership(statusPageId: number, userId: number, role?: string) {
    const page = await this.prisma.statusPage.findUnique({ where: { id: statusPageId } });
    if (!page) throw new NotFoundException(`StatusPage #${statusPageId} not found`);
    if (role !== 'ADMIN' && page.userId !== userId) throw new ForbiddenException();
    return page;
  }

  private async _verifyIncidentOwnership(incidentId: number, userId: number, role?: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { statusPage: true, updates: { orderBy: { createdAt: 'desc' } } },
    });
    if (!incident) throw new NotFoundException(`Incident #${incidentId} not found`);
    if (role !== 'ADMIN' && incident.statusPage.userId !== userId) throw new ForbiddenException();
    return incident;
  }

  async findAll(statusPageId: number, userId: number, role?: string) {
    await this._verifyStatusPageOwnership(statusPageId, userId, role);
    return this.prisma.incident.findMany({
      where: { statusPageId },
      orderBy: { createdAt: 'desc' },
      include: { updates: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async findOne(id: number, userId: number, role?: string) {
    return this._verifyIncidentOwnership(id, userId, role);
  }

  async create(statusPageId: number, userId: number, dto: CreateIncidentDto, role?: string) {
    await this._verifyStatusPageOwnership(statusPageId, userId, role);
    const incident = await this.prisma.incident.create({
      data: {
        statusPageId,
        title: dto.title,
        content: dto.content,
        severity: (dto.severity as IncidentSeverity) ?? IncidentSeverity.MINOR,
        pinned: dto.pinned ?? true,
      },
    });
    await this.subscriberService.notifySubscribers(statusPageId, {
      title: incident.title,
      status: incident.status,
      content: incident.content,
    });
    return incident;
  }

  async update(id: number, userId: number, dto: UpdateIncidentDto, role?: string) {
    const incident = await this._verifyIncidentOwnership(id, userId, role);
    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.severity !== undefined && { severity: dto.severity as IncidentSeverity }),
        ...(dto.status !== undefined && { status: dto.status as IncidentStatus }),
        ...(dto.pinned !== undefined && { pinned: dto.pinned }),
      },
    });
    if (dto.status && dto.status !== incident.status) {
      await this.subscriberService.notifySubscribers(incident.statusPageId, {
        title: updated.title,
        status: updated.status,
        content: updated.content,
      });
    }
    return updated;
  }

  async remove(id: number, userId: number, role?: string) {
    await this._verifyIncidentOwnership(id, userId, role);
    await this.prisma.incident.delete({ where: { id } });
    return { message: `Incident #${id} deleted` };
  }

  async addUpdate(
    incidentId: number,
    userId: number,
    dto: CreateIncidentUpdateDto,
    role?: string,
  ) {
    const incident = await this._verifyIncidentOwnership(incidentId, userId, role);
    const update = await this.prisma.incidentUpdate.create({
      data: {
        incidentId,
        content: dto.content,
        status: dto.status as IncidentStatus,
      },
    });
    const updatedIncident = await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: dto.status as IncidentStatus },
    });
    if (dto.status !== incident.status) {
      await this.subscriberService.notifySubscribers(incident.statusPageId, {
        title: updatedIncident.title,
        status: updatedIncident.status,
        content: dto.content,
      });
    }
    return update;
  }
}
