import { Injectable } from '@nestjs/common';
import Dockerode from 'dockerode';
import type { MonitorStrategy, CheckResult } from './monitor-strategy.interface.js';

@Injectable()
export class DockerStrategy implements MonitorStrategy {
  async check(config: Record<string, unknown>): Promise<CheckResult> {
    const start = Date.now();
    try {
      const socketPath = config['socketPath'] as string | undefined;
      const host = config['host'] as string | undefined;
      const port = config['port'] as number | undefined;
      const containerId = config['containerId'] as string;

      const docker = new Dockerode(
        socketPath
          ? { socketPath }
          : { host: host || 'localhost', port: port || 2375 },
      );

      const container = docker.getContainer(containerId);
      const info = await container.inspect();
      const ping = Date.now() - start;
      return {
        status: info.State.Running === true,
        ping,
        message: `Container state: ${info.State.Status}`,
      };
    } catch (err) {
      return { status: false, ping: 0, message: err instanceof Error ? err.message : String(err) };
    }
  }
}
