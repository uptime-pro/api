import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import type { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import type { ApiKeyResponseDto, ApiKeyCreatedResponseDto } from './dto/api-key-response.dto.js';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(userId: number): Promise<ApiKeyResponseDto[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(({ key: _k, ...k }) => k);
  }

  async create(userId: number, dto: CreateApiKeyDto, ip?: string): Promise<ApiKeyCreatedResponseDto> {
    const rawKey = crypto.randomBytes(32).toString('hex');
    const hashed = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);
    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        key: hashed,
        permission: dto.permission,
        expires: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    await this.audit.log({ userId, action: 'apikey.create', entity: 'ApiKey', entityId: apiKey.id, meta: { name: dto.name, permission: dto.permission }, ip });
    const { key: _k, ...rest } = apiKey;
    return { ...rest, key: rawKey };
  }

  async remove(id: number, userId: number, ip?: string): Promise<{ message: string }> {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey) throw new NotFoundException(`API key #${id} not found`);
    if (apiKey.userId !== userId) throw new ForbiddenException('Access denied');
    await this.prisma.apiKey.delete({ where: { id } });
    await this.audit.log({ userId, action: 'apikey.delete', entity: 'ApiKey', entityId: id, ip });
    return { message: `API key #${id} revoked` };
  }
}
