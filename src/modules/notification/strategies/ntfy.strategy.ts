import { Injectable } from '@nestjs/common';
import type { NotificationStrategy, NotificationPayload } from './notification-strategy.interface.js';

@Injectable()
export class NtfyStrategy implements NotificationStrategy {
  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<void> {
    const serverUrl = config['serverUrl'] as string;
    const topic = config['topic'] as string;
    const authToken = config['authToken'] as string | undefined;
    if (!serverUrl) throw new Error('ntfy serverUrl is required');
    if (!topic) throw new Error('ntfy topic is required');

    const statusText = payload.status ? 'UP' : 'DOWN';
    const url = `${serverUrl.replace(/\/$/, '')}/${topic}`;

    const headers: Record<string, string> = {
      'Content-Type': 'text/plain',
      'Title': `Monitor ${statusText}: ${payload.monitorName}`,
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: payload.message,
    });
    if (!res.ok) throw new Error(`ntfy failed: ${res.status} ${res.statusText}`);
  }
}
