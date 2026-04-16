import { Injectable } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class RabbitmqStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    let connection: amqp.ChannelModel | undefined;
    try {
      let url = config['url'] as string | undefined;
      if (!url) {
        const host = (config['host'] as string | undefined) || 'localhost';
        const port = (config['port'] as number | undefined) || 5672;
        const username = (config['username'] as string | undefined) || 'guest';
        const password = (config['password'] as string | undefined) || 'guest';
        const vhost = encodeURIComponent((config['vhost'] as string | undefined) || '/');
        url = `amqp://${username}:${password}@${host}:${port}/${vhost}`;
      }
      connection = await amqp.connect(url, { timeout: 10000 } as amqp.Options.Connect);
      const ping = Date.now() - start;
      return { status: true, ping, message: 'RabbitMQ connection successful' };
    } catch (err) {
      return { status: false, ping: 0, message: err instanceof Error ? err.message : String(err) };
    } finally {
      try { await connection?.close(); } catch { /* ignore */ }
    }
  }
}
