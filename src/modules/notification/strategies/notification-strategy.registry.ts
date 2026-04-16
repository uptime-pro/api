import { Injectable, BadRequestException } from '@nestjs/common';
import type { NotificationStrategy } from './notification-strategy.interface.js';
import { DiscordStrategy } from './discord.strategy.js';
import { SlackStrategy } from './slack.strategy.js';
import { EmailStrategy } from './email.strategy.js';
import { WebhookStrategy } from './webhook.strategy.js';
import { TeamsStrategy } from './teams.strategy.js';
import { TelegramStrategy } from './telegram.strategy.js';
import { PushoverStrategy } from './pushover.strategy.js';
import { GotifyStrategy } from './gotify.strategy.js';
import { NtfyStrategy } from './ntfy.strategy.js';

@Injectable()
export class NotificationStrategyRegistry {
  private readonly strategies: Map<string, NotificationStrategy>;

  constructor(
    private readonly discord: DiscordStrategy,
    private readonly slack: SlackStrategy,
    private readonly email: EmailStrategy,
    private readonly webhook: WebhookStrategy,
    private readonly teams: TeamsStrategy,
    private readonly telegram: TelegramStrategy,
    private readonly pushover: PushoverStrategy,
    private readonly gotify: GotifyStrategy,
    private readonly ntfy: NtfyStrategy,
  ) {
    this.strategies = new Map([
      ['discord', this.discord],
      ['slack', this.slack],
      ['email', this.email],
      ['webhook', this.webhook],
      ['teams', this.teams],
      ['telegram', this.telegram],
      ['pushover', this.pushover],
      ['gotify', this.gotify],
      ['ntfy', this.ntfy],
    ]);
  }

  getStrategy(type: string): NotificationStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) throw new BadRequestException(`Unknown notification type: ${type}`);
    return strategy;
  }
}
