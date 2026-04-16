import { Injectable } from '@nestjs/common';
import type { NotificationStrategy, NotificationPayload } from './notification-strategy.interface.js';

@Injectable()
export class WebhookStrategy implements NotificationStrategy {
  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<void> {
    const url = config['url'] as string;
    if (!url) throw new Error('Webhook url is required');

    const extraHeaders = (config['headers'] as Record<string, string>) ?? {};

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Webhook failed: ${res.status} ${res.statusText}`);
  }
}
