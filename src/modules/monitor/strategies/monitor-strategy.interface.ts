export interface CheckResult {
  status: boolean;
  ping: number;
  message: string;
}

export interface MonitorStrategy {
  check(config: Record<string, unknown>): Promise<CheckResult>;
}
