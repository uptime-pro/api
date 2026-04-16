import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { NotificationStrategy, NotificationPayload } from './notification-strategy.interface.js';

@Injectable()
export class EmailStrategy implements NotificationStrategy {
  async send(config: Record<string, unknown>, payload: NotificationPayload): Promise<void> {
    const { host, port, secure, username, password, from, to } = config as {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password: string;
      from: string;
      to: string;
    };

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: Boolean(secure),
      auth: username ? { user: username, pass: password } : undefined,
    });

    const statusText = payload.status ? 'UP' : 'DOWN';
    const subject = `[${statusText}] ${payload.monitorName}`;
    const html = `
      <h2>${payload.status ? '✅' : '🔴'} Monitor ${statusText}: ${payload.monitorName}</h2>
      <p><strong>Message:</strong> ${payload.message}</p>
      ${payload.ping != null ? `<p><strong>Ping:</strong> ${payload.ping}ms</p>` : ''}
      <p><strong>Time:</strong> ${payload.timestamp}</p>
    `;

    await transporter.sendMail({ from, to, subject, html });
  }
}
