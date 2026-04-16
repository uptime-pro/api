import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [WsGateway],
  exports: [WsGateway],
})
export class WsModule {}
