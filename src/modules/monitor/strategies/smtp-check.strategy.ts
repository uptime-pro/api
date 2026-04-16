import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class SmtpCheckStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    const transporter = nodemailer.createTransport({
      host: config['host'] as string,
      port: (config['port'] as number | undefined) || 587,
      secure: !!(config['secure'] as boolean | undefined),
      auth: config['username']
        ? { user: config['username'] as string, pass: config['password'] as string | undefined }
        : undefined,
      connectionTimeout: 9000,
      greetingTimeout: 9000,
      socketTimeout: 9000,
    } as Parameters<typeof nodemailer.createTransport>[0]);
    try {
      await transporter.verify();
      const ping = Date.now() - start;
      return { status: true, ping, message: 'SMTP connection verified' };
    } catch (err) {
      return { status: false, ping: 0, message: err instanceof Error ? err.message : String(err) };
    } finally {
      try { transporter.close(); } catch { /* ignore */ }
    }
  }
}
