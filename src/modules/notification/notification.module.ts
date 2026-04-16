import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule, NOTIFICATION_QUEUE } from '../../queue/queue.module.js';
import { EncryptionModule } from '../../encryption/encryption.module.js';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { NotificationStrategyRegistry } from './strategies/notification-strategy.registry.js';
import { DiscordStrategy } from './strategies/discord.strategy.js';
import { SlackStrategy } from './strategies/slack.strategy.js';
import { EmailStrategy } from './strategies/email.strategy.js';
import { WebhookStrategy } from './strategies/webhook.strategy.js';
import { TeamsStrategy } from './strategies/teams.strategy.js';
import { TelegramStrategy } from './strategies/telegram.strategy.js';
import { PushoverStrategy } from './strategies/pushover.strategy.js';
import { GotifyStrategy } from './strategies/gotify.strategy.js';
import { NtfyStrategy } from './strategies/ntfy.strategy.js';
import { NotificationWorker } from '../../workers/notification.worker.js';

@Module({
  imports: [
    QueueModule,
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    EncryptionModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationStrategyRegistry,
    DiscordStrategy,
    SlackStrategy,
    EmailStrategy,
    WebhookStrategy,
    TeamsStrategy,
    TelegramStrategy,
    PushoverStrategy,
    GotifyStrategy,
    NtfyStrategy,
    NotificationWorker,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
