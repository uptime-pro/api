import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SubscriberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async subscribe(statusPageId: number, dto: { email?: string; webhookUrl?: string }) {
    if (!dto.email && !dto.webhookUrl) {
      throw new BadRequestException('Either email or webhookUrl is required');
    }
    return this.prisma.subscriber.create({ data: { statusPageId, ...dto } });
  }

  async unsubscribe(token: string) {
    await this.prisma.subscriber.update({ where: { token }, data: { active: false } });
  }

  async notifySubscribers(
    statusPageId: number,
    incident: { title: string; status: string; content: string },
  ) {
    const subscribers = await this.prisma.subscriber.findMany({
      where: { statusPageId, active: true },
    });
    await Promise.allSettled([
      ...subscribers
        .filter((s) => s.email)
        .map((s) => this.sendEmailNotification(s.email!, incident)),
      ...subscribers
        .filter((s) => s.webhookUrl)
        .map((s) => this.sendWebhookNotification(s.webhookUrl!, incident)),
    ]);
  }

  private async sendEmailNotification(
    email: string,
    incident: { title: string; status: string; content: string },
  ) {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: parseInt(this.config.get('SMTP_PORT', '587')),
      auth:
        this.config.get('SMTP_USER')
          ? { user: this.config.get('SMTP_USER'), pass: this.config.get('SMTP_PASS') }
          : undefined,
    });
    await transporter.sendMail({
      from: this.config.get('SMTP_FROM', 'noreply@example.com'),
      to: email,
      subject: `[${incident.status}] ${incident.title}`,
      text: incident.content,
    });
  }

  private async sendWebhookNotification(
    url: string,
    incident: { title: string; status: string; content: string },
  ) {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'incident', ...incident }),
      signal: AbortSignal.timeout(10000),
    });
  }
}
