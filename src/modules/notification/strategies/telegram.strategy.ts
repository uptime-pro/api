import { Injectable } from '@nestjs/common';
import type { NotificationStrategy, NotificationPayload } from './notification-strategy.interface.js';

@Injectable()
export class TelegramStrategy implements NotificationStrategy {
  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<void> {
    const botToken = config['botToken'] as string;
    const chatId = config['chatId'] as string;
    if (!botToken) throw new Error('Telegram botToken is required');
    if (!chatId) throw new Error('Telegram chatId is required');

    const statusText = payload.status ? '✅ UP' : '🔴 DOWN';
    const text = `${statusText} — *${payload.monitorName}*\n${payload.message}${payload.ping != null ? `\nPing: ${payload.ping}ms` : ''}`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    if (!res.ok) throw new Error(`Telegram API failed: ${res.status} ${res.statusText}`);
  }
}
