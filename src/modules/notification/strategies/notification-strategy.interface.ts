export interface NotificationPayload {
  monitorName: string;
  monitorId: number;
  status: boolean;
  previousStatus: boolean | null;
  message: string;
  ping: number | null;
  timestamp: string;
}

export interface NotificationStrategy {
  send(config: Record<string, unknown>, payload: NotificationPayload): Promise<void>;
}
