import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { generateSecret, generateSync, verifySync, generateURI } from 'otplib';
import * as QRCode from 'qrcode';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { Verify2faDto } from './dto/verify-2fa.dto.js';
import type { SetupDto } from './dto/setup.dto.js';

const BACKUP_CODE_COUNT = 8;
const BCRYPT_ROUNDS = 10;
const COOKIE_NAME = 'access_token';

function generateBackupCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${segment()}-${segment()}`;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, res: Response): Promise<{ message: string; requiresTwoFactor?: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user || !user.active) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    if (user.twoFaActive) {
      if (!dto.totpCode) {
        return { message: 'Two-factor authentication required', requiresTwoFactor: true };
      }
      const verified = await this.verifyTotpOrBackup(user.id, user.twoFaSecret!, user.backupCodes, dto.totpCode);
      if (!verified) throw new UnauthorizedException('Invalid two-factor code');
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = this.jwt.sign(payload);
    this.setAuthCookie(res, token);
    return { message: 'Login successful' };
  }

  private async verifyTotpOrBackup(
    userId: number,
    secret: string,
    backupCodes: string[],
    code: string,
  ): Promise<boolean> {
    if (verifySync({ token: code, secret })) return true;

    for (let i = 0; i < backupCodes.length; i++) {
      const match = await bcrypt.compare(code, backupCodes[i]);
      if (match) {
        const remaining = [...backupCodes];
        remaining.splice(i, 1);
        await this.prisma.user.update({ where: { id: userId }, data: { backupCodes: remaining } });
        return true;
      }
    }
    return false;
  }

  logout(res: Response): { message: string } {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', path: '/' });
    return { message: 'Logged out successfully' };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const { password: _p, twoFaSecret: _s, backupCodes: _b, ...safe } = user;
    return safe;
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { message: 'Password changed successfully' };
  }

  async setup2fa(userId: number): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.twoFaActive) throw new BadRequestException('Two-factor authentication is already active');

    const secret = generateSecret();
    const otpauthUrl = generateURI({ issuer: 'UptimePro', label: user.username, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    await this.prisma.user.update({ where: { id: userId }, data: { twoFaSecret: secret } });
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async verify2fa(userId: number, dto: Verify2faDto): Promise<{ message: string; backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFaSecret) throw new BadRequestException('2FA setup not initiated');
    if (user.twoFaActive) throw new BadRequestException('Two-factor authentication is already active');

    const valid = verifySync({ token: dto.code, secret: user.twoFaSecret });
    if (!valid) throw new BadRequestException('Invalid TOTP code');

    const plainCodes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
    const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaActive: true, backupCodes: hashedCodes },
    });

    return { message: 'Two-factor authentication enabled', backupCodes: plainCodes };
  }

  async disable2fa(userId: number, password: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.twoFaActive) throw new BadRequestException('Two-factor authentication is not active');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new BadRequestException('Invalid password');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaActive: false, twoFaSecret: null, backupCodes: [] },
    });
    return { message: 'Two-factor authentication disabled' };
  }

  get2faStatus(userId: number): Promise<{ enabled: boolean }> {
    return this.prisma.user
      .findUnique({ where: { id: userId }, select: { twoFaActive: true } })
      .then((u) => ({ enabled: u?.twoFaActive ?? false }));
  }

  async getSetupStatus(): Promise<{ setupComplete: boolean }> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'setup_complete' } });
    return { setupComplete: setting?.value === 'true' };
  }

  async setupAdmin(dto: SetupDto): Promise<{ message: string }> {
    const { setupComplete } = await this.getSetupStatus();
    if (setupComplete) throw new ForbiddenException('Setup already complete');

    const existingUser = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existingUser) throw new ConflictException('Username already exists');

    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existingEmail) throw new ConflictException('Email already exists');
    }

    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.prisma.user.create({
      data: {
        username: dto.username,
        password: hashed,
        email: dto.email,
        role: 'ADMIN',
        active: true,
      },
    });

    await this.prisma.setting.upsert({
      where: { key: 'setup_complete' },
      update: { value: 'true' },
      create: { key: 'setup_complete', value: 'true' },
    });

    return { message: 'Admin account created successfully' };
  }

  private setAuthCookie(res: Response, token: string): void {
    const secure = this.config.get('COOKIE_SECURE') === 'true';
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
