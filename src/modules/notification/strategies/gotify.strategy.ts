import { Injectable } from '@nestjs/common';
import type { NotificationStrategy, NotificationPayload } from './notification-strategy.interface.js';

@Injectable()
export class GotifyStrategy implements NotificationStrategy {
  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<void> {
    const serverUrl = config['serverUrl'] as string;
    const token = config['token'] as string;
    if (!serverUrl) throw new Error('Gotify serverUrl is required');
    if (!token) throw new Error('Gotify token is required');

    const statusText = payload.status ? 'UP' : 'DOWN';
    const url = `${serverUrl.replace(/\/$/, '')}/message?token=${token}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Monitor ${statusText}: ${payload.monitorName}`,
        message: payload.message,
        priority: payload.status ? 5 : 8,
      }),
    });
    if (!res.ok) throw new Error(`Gotify failed: ${res.status} ${res.statusText}`);
  }
}
