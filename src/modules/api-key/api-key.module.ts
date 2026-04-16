import { Module } from '@nestjs/common';
import { ApiKeyController } from './api-key.controller.js';
import { ApiKeyService } from './api-key.service.js';
import { AuditModule } from '../../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
})
export class ApiKeyModule {}
