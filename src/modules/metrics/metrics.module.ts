import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { makeGaugeProvider, makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
  ],
  providers: [
    makeGaugeProvider({
      name: 'uptime_monitors_total',
      help: 'Total number of active monitors',
    }),
    makeCounterProvider({
      name: 'uptime_checks_total',
      help: 'Total heartbeat checks performed',
    }),
    makeGaugeProvider({
      name: 'uptime_monitors_up',
      help: 'Number of monitors currently up',
    }),
    makeGaugeProvider({
      name: 'uptime_monitors_down',
      help: 'Number of monitors currently down',
    }),
  ],
  exports: [PrometheusModule],
})
export class MetricsModule {}
