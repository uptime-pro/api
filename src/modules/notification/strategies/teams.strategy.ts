import { Injectable } from '@nestjs/common';
import type { NotificationStrategy, NotificationPayload } from './notification-strategy.interface.js';

@Injectable()
export class TeamsStrategy implements NotificationStrategy {
  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<void> {
    const webhookUrl = config['webhookUrl'] as string;
    if (!webhookUrl) throw new Error('Teams webhookUrl is required');

    const statusText = payload.status ? '✅ UP' : '🔴 DOWN';
    const themeColor = payload.status ? '2ecc71' : 'e74c3c';

    const body = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor,
      summary: `${statusText} — ${payload.monitorName}`,
      sections: [
        {
          activityTitle: `${statusText} — ${payload.monitorName}`,
          activityText: payload.message,
          facts: [
            { name: 'Status', value: statusText },
            { name: 'Ping', value: payload.ping != null ? `${payload.ping}ms` : 'N/A' },
            { name: 'Time', value: payload.timestamp },
          ],
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Teams webhook failed: ${res.status} ${res.statusText}`);
  }
}
