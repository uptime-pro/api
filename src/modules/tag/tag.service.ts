import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { CreateTagDto } from './dto/create-tag.dto.js';
import { UpdateTagDto } from './dto/update-tag.dto.js';

@Injectable()
export class TagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(userId: number) {
    return this.prisma.tag.findMany({ where: { userId } });
  }

  async findOne(id: number, userId: number) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException(`Tag ${id} not found`);
    if (tag.userId !== userId) throw new ForbiddenException('Access denied');
    return tag;
  }

  async create(userId: number, dto: CreateTagDto, ip?: string) {
    const tag = await this.prisma.tag.create({ data: { ...dto, userId } });
    await this.audit.log({ userId, action: 'tag.create', entity: 'Tag', entityId: tag.id, meta: { name: tag.name }, ip });
    return tag;
  }

  async update(id: number, userId: number, dto: UpdateTagDto, ip?: string) {
    await this.findOne(id, userId);
    const tag = await this.prisma.tag.update({ where: { id }, data: dto });
    await this.audit.log({ userId, action: 'tag.update', entity: 'Tag', entityId: id, meta: { ...dto }, ip });
    return tag;
  }

  async delete(id: number, userId: number, ip?: string) {
    await this.findOne(id, userId);
    await this.prisma.tag.delete({ where: { id } });
    await this.audit.log({ userId, action: 'tag.delete', entity: 'Tag', entityId: id, ip });
  }

  async setMonitors(tagId: number, userId: number, monitorIds: number[], ip?: string) {
    await this.findOne(tagId, userId);
    if (monitorIds.length > 0) {
      const monitors = await this.prisma.monitor.findMany({
        where: { id: { in: monitorIds }, userId },
        select: { id: true },
      });
      if (monitors.length !== monitorIds.length) {
        throw new ForbiddenException('One or more monitors not found or not owned by you');
      }
    }
    await this.prisma.$transaction([
      this.prisma.monitorTag.deleteMany({ where: { tagId } }),
      ...monitorIds.map((monitorId) =>
        this.prisma.monitorTag.create({ data: { tagId, monitorId } }),
      ),
    ]);
    await this.audit.log({ userId, action: 'tag.setMonitors', entity: 'Tag', entityId: tagId, meta: { monitorIds }, ip });
    return { monitorIds };
  }

  async getMonitors(tagId: number, userId: number) {
    await this.findOne(tagId, userId);
    const rows = await this.prisma.monitorTag.findMany({
      where: { tagId },
      include: { monitor: true },
    });
    return rows.map((r) => r.monitor);
  }
}
