import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('MOCKSECRET'),
  generateSync: jest.fn().mockReturnValue('123456'),
  verifySync: jest.fn().mockReturnValue(false),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/UptimePro:admin?secret=MOCKSECRET&issuer=UptimePro'),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockedqr'),
}));

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  setting: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-token'),
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, def?: unknown) => {
    if (key === 'NODE_ENV') return 'test';
    return def;
  }),
};

const mockRes: any = {
  cookie: jest.fn(),
  clearCookie: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockJwt.sign.mockReturnValue('mock-token');
    mockConfig.get.mockImplementation((key: string, def?: unknown) => {
      if (key === 'NODE_ENV') return 'test';
      return def;
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const hashedPw = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'admin',
        password: hashedPw,
        role: 'ADMIN',
        active: true,
        twoFaActive: false,
      });

      const result = await service.login({ username: 'admin', password: 'password123' }, mockRes);
      expect(result.message).toBe('Login successful');
      expect(mockRes.cookie).toHaveBeenCalledWith('access_token', 'mock-token', expect.any(Object));
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      const hashedPw = await bcrypt.hash('correctpassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'admin',
        password: hashedPw,
        active: true,
        twoFaActive: false,
      });

      await expect(
        service.login({ username: 'admin', password: 'wrongpassword' }, mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ username: 'nobody', password: 'pass' }, mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return requiresTwoFactor when 2FA active and no code provided', async () => {
      const hashedPw = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'admin',
        password: hashedPw,
        active: true,
        twoFaActive: true,
        twoFaSecret: 'SECRET',
        backupCodes: [],
      });

      const result = await service.login({ username: 'admin', password: 'password123' }, mockRes);
      expect(result.requiresTwoFactor).toBe(true);
    });

    it('should throw for inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'inactive',
        password: await bcrypt.hash('pass', 10),
        active: false,
        twoFaActive: false,
      });

      await expect(
        service.login({ username: 'inactive', password: 'pass' }, mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should clear the access_token cookie', () => {
      const result = service.logout(mockRes);
      expect(result.message).toBe('Logged out successfully');
      expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
    });
  });

  describe('me', () => {
    it('should return sanitized user (no password/secret/backupCodes)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'admin',
        password: 'hashed',
        twoFaSecret: 'secret',
        backupCodes: ['code1'],
        role: 'ADMIN',
        active: true,
        email: null,
        twoFaActive: false,
        timezone: null,
        theme: 'auto',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.me(1);
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('twoFaSecret');
      expect(result).not.toHaveProperty('backupCodes');
      expect(result).toHaveProperty('username', 'admin');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.me(999)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const hashedPw = await bcrypt.hash('oldpassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, password: hashedPw });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.changePassword(1, {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      });
      expect(result.message).toBe('Password changed successfully');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('should throw BadRequestException for wrong current password', async () => {
      const hashedPw = await bcrypt.hash('correctpassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, password: hashedPw });

      await expect(
        service.changePassword(1, { currentPassword: 'wrongpassword', newPassword: 'new123456' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2FA setup', () => {
    it('should return secret, otpauthUrl, and qrCodeDataUrl', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'admin',
        twoFaActive: false,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.setup2fa(1);
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('otpauthUrl');
      expect(result).toHaveProperty('qrCodeDataUrl');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('should throw BadRequestException if 2FA already active', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin', twoFaActive: true });
      await expect(service.setup2fa(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('2FA verify', () => {
    it('should activate 2FA and return backup codes', async () => {
      const { verifySync } = jest.requireMock('otplib');
      verifySync.mockReturnValue(true);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        twoFaSecret: 'MOCKSECRET',
        twoFaActive: false,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.verify2fa(1, { code: '123456' });
      expect(result.message).toBe('Two-factor authentication enabled');
      expect(result.backupCodes).toHaveLength(8);
      expect(result.backupCodes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should throw BadRequestException for invalid TOTP code', async () => {
      const { verifySync } = jest.requireMock('otplib');
      verifySync.mockReturnValue(false);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        twoFaSecret: 'MOCKSECRET',
        twoFaActive: false,
      });

      await expect(service.verify2fa(1, { code: '000000' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('disable 2FA', () => {
    it('should disable 2FA with correct password', async () => {
      const hashedPw = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        password: hashedPw,
        twoFaActive: true,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.disable2fa(1, 'password123');
      expect(result.message).toBe('Two-factor authentication disabled');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { twoFaActive: false, twoFaSecret: null, backupCodes: [] },
      });
    });

    it('should throw BadRequestException for wrong password', async () => {
      const hashedPw = await bcrypt.hash('correctpassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        password: hashedPw,
        twoFaActive: true,
      });

      await expect(service.disable2fa(1, 'wrongpassword')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if 2FA not active', async () => {
      const hashedPw = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        password: hashedPw,
        twoFaActive: false,
      });

      await expect(service.disable2fa(1, 'password123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('backup code login', () => {
    it('should accept a backup code and remove it after use', async () => {
      const { verifySync } = jest.requireMock('otplib');
      verifySync.mockReturnValue(false); // TOTP fails, use backup code

      const plainCode = 'ABCD-EFGH';
      const hashedCode = await bcrypt.hash(plainCode, 10);
      const hashedPw = await bcrypt.hash('password123', 10);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'admin',
        password: hashedPw,
        active: true,
        twoFaActive: true,
        twoFaSecret: 'MOCKSECRET',
        backupCodes: [hashedCode],
        role: 'ADMIN',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.login(
        { username: 'admin', password: 'password123', totpCode: plainCode },
        mockRes,
      );

      expect(result.message).toBe('Login successful');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { backupCodes: [] },
      });
    });
  });

  describe('getSetupStatus', () => {
    it('should return setupComplete: false when no setting exists', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(null);
      const result = await service.getSetupStatus();
      expect(result.setupComplete).toBe(false);
    });

    it('should return setupComplete: true when setting is set', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue({ key: 'setup_complete', value: 'true' });
      const result = await service.getSetupStatus();
      expect(result.setupComplete).toBe(true);
    });
  });

  describe('setupAdmin', () => {
    it('should create admin user when setup not complete', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 1, username: 'admin' });
      mockPrisma.setting.upsert.mockResolvedValue({});

      const result = await service.setupAdmin({ username: 'admin', password: 'password123' });
      expect(result.message).toBe('Admin account created successfully');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'ADMIN' }) }),
      );
    });

    it('should throw ForbiddenException if setup already complete', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue({ key: 'setup_complete', value: 'true' });
      await expect(
        service.setupAdmin({ username: 'admin', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if username already exists', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin' });
      await expect(
        service.setupAdmin({ username: 'admin', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
