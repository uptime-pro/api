import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { JwtPayload } from '../../decorators/current-user.decorator.js';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitize(user: { password: string; twoFaSecret: string | null; backupCodes: string[]; [key: string]: unknown }) {
    const { password: _p, twoFaSecret: _s, backupCodes: _b, ...safe } = user;
    return safe;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map((u) => this.sanitize(u));
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return this.sanitize(user);
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) throw new ConflictException('Username already exists');

    if (dto.email) {
      const emailExists = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (emailExists) throw new ConflictException('Email already exists');
    }

    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password: hashed,
        email: dto.email,
        role: dto.role ?? 'VIEWER',
      },
    });
    return this.sanitize(user);
  }

  async update(id: number, dto: UpdateUserDto, requestingUser: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);

    if (dto.role !== undefined && requestingUser.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can change user roles');
    }

    if (requestingUser.role !== 'ADMIN' && requestingUser.sub !== id) {
      throw new ForbiddenException('You can only update your own account');
    }

    const data: Record<string, unknown> = {};
    if (dto.email !== undefined) data['email'] = dto.email;
    if (dto.role !== undefined) data['role'] = dto.role;
    if (dto.active !== undefined) data['active'] = dto.active;
    if (dto.timezone !== undefined) data['timezone'] = dto.timezone;
    if (dto.theme !== undefined) data['theme'] = dto.theme;
    if (dto.password !== undefined) {
      data['password'] = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }

    const updated = await this.prisma.user.update({ where: { id }, data });
    return this.sanitize(updated);
  }

  async remove(id: number): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    await this.prisma.user.delete({ where: { id } });
    return { message: `User #${id} deleted` };
  }
}
