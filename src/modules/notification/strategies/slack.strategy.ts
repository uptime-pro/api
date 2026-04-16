import { Injectable } from '@nestjs/common';
import type { NotificationStrategy, NotificationPayload } from './notification-strategy.interface.js';

@Injectable()
export class SlackStrategy implements NotificationStrategy {
  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<void> {
    const webhookUrl = config['webhookUrl'] as string;
    if (!webhookUrl) throw new Error('Slack webhookUrl is required');

    const statusText = payload.status ? '✅ UP' : '🔴 DOWN';
    const text = `*${statusText} — ${payload.monitorName}*\n${payload.message}${payload.ping != null ? `\nPing: ${payload.ping}ms` : ''}`;

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Slack webhook failed: ${res.status} ${res.statusText}`);
  }
}
