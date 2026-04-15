import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  requiresTwoFactor?: boolean;
}

export class TwoFaStatusDto {
  @ApiProperty()
  enabled: boolean;
}

export class TwoFaSetupResponseDto {
  @ApiProperty()
  secret: string;

  @ApiProperty()
  otpauthUrl: string;

  @ApiProperty()
  qrCodeDataUrl: string;
}

export class TwoFaVerifyResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: [String], description: 'One-time backup codes — store safely' })
  backupCodes: string[];
}

export class SetupStatusDto {
  @ApiProperty()
  setupComplete: boolean;
}
