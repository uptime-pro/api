export interface CheckResult {
  status: boolean;
  ping: number;
  message: string;
  meta?: Record<string, unknown>;
}

export interface MonitorStrategy {
  check(config: Record<string, unknown>): Promise<CheckResult>;
}
