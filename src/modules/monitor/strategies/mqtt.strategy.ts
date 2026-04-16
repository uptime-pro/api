import { Injectable } from '@nestjs/common';
import * as mqtt from 'mqtt';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class MqttStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    return new Promise<CheckResult>((resolve) => {
      const timeout = setTimeout(() => {
        client.end(true);
        resolve({ status: false, ping: 0, message: 'MQTT connection timed out' });
      }, 10000);

      const client = mqtt.connect(config['brokerUrl'] as string, {
        username: config['username'] as string | undefined,
        password: config['password'] as string | undefined,
        clientId: (config['clientId'] as string | undefined) || `uptimepro-${Date.now()}`,
        connectTimeout: 9000,
      });

      client.on('connect', () => {
        clearTimeout(timeout);
        const ping = Date.now() - start;
        client.end(false, {}, () => {
          resolve({ status: true, ping, message: 'MQTT connection successful' });
        });
      });

      client.on('error', (err: Error) => {
        clearTimeout(timeout);
        client.end(true);
        resolve({ status: false, ping: 0, message: err.message });
      });
    });
  }
}
