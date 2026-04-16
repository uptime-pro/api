import { Injectable } from '@nestjs/common';
import type { NotificationStrategy, NotificationPayload } from './notification-strategy.interface.js';

@Injectable()
export class PushoverStrategy implements NotificationStrategy {
  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<void> {
    const token = config['token'] as string;
    const user = (config['userKey'] ?? config['user']) as string;
    if (!token) throw new Error('Pushover token is required');
    if (!user) throw new Error('Pushover userKey is required');

    const statusText = payload.status ? 'UP' : 'DOWN';
    const message = `${payload.monitorName} is ${statusText}. ${payload.message}`;

    const res = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, user, message, title: `Monitor ${statusText}` }),
    });
    if (!res.ok) throw new Error(`Pushover failed: ${res.status} ${res.statusText}`);
  }
}
