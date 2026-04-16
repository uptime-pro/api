import { Injectable } from '@nestjs/common';
import type { NotificationStrategy, NotificationPayload } from './notification-strategy.interface.js';

@Injectable()
export class DiscordStrategy implements NotificationStrategy {
  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<void> {
    const webhookUrl = config['webhookUrl'] as string;
    if (!webhookUrl) throw new Error('Discord webhookUrl is required');

    const color = payload.status ? 0x2ecc71 : 0xe74c3c;
    const statusText = payload.status ? '✅ UP' : '🔴 DOWN';

    const body = {
      embeds: [
        {
          title: `${statusText} — ${payload.monitorName}`,
          description: payload.message,
          color,
          fields: [
            { name: 'Status', value: statusText, inline: true },
            { name: 'Ping', value: payload.ping != null ? `${payload.ping}ms` : 'N/A', inline: true },
            { name: 'Monitor ID', value: String(payload.monitorId), inline: true },
          ],
          timestamp: payload.timestamp,
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} ${res.statusText}`);
  }
}
