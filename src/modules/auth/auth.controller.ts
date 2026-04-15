import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { Verify2faDto } from './dto/verify-2fa.dto.js';
import { Disable2faDto } from './dto/disable-2fa.dto.js';
import { SetupDto } from './dto/setup.dto.js';
import {
  AuthResponseDto,
  TwoFaStatusDto,
  TwoFaSetupResponseDto,
  TwoFaVerifyResponseDto,
  SetupStatusDto,
} from './dto/auth-response.dto.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { CurrentUser, type JwtPayload } from '../../decorators/current-user.decorator.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with username and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.login(dto, res);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Logout and clear session cookie' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  logout(@Res({ passthrough: true }) res: Response): AuthResponseDto {
    return this.authService.logout(res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Change current user password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current password' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(user.sub, dto);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Initiate 2FA setup — returns TOTP secret and QR code' })
  @ApiResponse({ status: 200, description: '2FA setup initiated', type: TwoFaSetupResponseDto })
  @ApiResponse({ status: 400, description: '2FA already active' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  setup2fa(@CurrentUser() user: JwtPayload): Promise<TwoFaSetupResponseDto> {
    return this.authService.setup2fa(user.sub);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Verify TOTP code and activate 2FA' })
  @ApiBody({ type: Verify2faDto })
  @ApiResponse({ status: 200, description: '2FA activated with backup codes', type: TwoFaVerifyResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid TOTP code' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  verify2fa(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Verify2faDto,
  ): Promise<TwoFaVerifyResponseDto> {
    return this.authService.verify2fa(user.sub, dto);
  }

  @Delete('2fa')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Disable 2FA (requires password confirmation)' })
  @ApiBody({ type: Disable2faDto })
  @ApiResponse({ status: 200, description: '2FA disabled' })
  @ApiResponse({ status: 400, description: 'Invalid password or 2FA not active' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  disable2fa(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Disable2faDto,
  ): Promise<{ message: string }> {
    return this.authService.disable2fa(user.sub, dto.password);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get current 2FA status' })
  @ApiResponse({ status: 200, description: '2FA status', type: TwoFaStatusDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  get2faStatus(@CurrentUser() user: JwtPayload): Promise<TwoFaStatusDto> {
    return this.authService.get2faStatus(user.sub);
  }

  @Get('setup-status')
  @ApiOperation({ summary: 'Check if initial setup has been completed' })
  @ApiResponse({ status: 200, description: 'Setup status', type: SetupStatusDto })
  getSetupStatus(): Promise<SetupStatusDto> {
    return this.authService.getSetupStatus();
  }

  @Post('setup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create first admin account (only works before setup is complete)' })
  @ApiBody({ type: SetupDto })
  @ApiResponse({ status: 201, description: 'Admin account created', type: AuthResponseDto })
  @ApiResponse({ status: 403, description: 'Setup already complete' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  setupAdmin(@Body() dto: SetupDto): Promise<{ message: string }> {
    return this.authService.setupAdmin(dto);
  }
}
