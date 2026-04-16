import * as tls from 'node:tls';

export interface SslCertCheckOptions {
  port?: number;
  warningDays?: number;
  criticalDays?: number;
  timeout?: number;
}

export interface SslCertCheckResult {
  status: boolean;
  ping: number;
  message: string;
  meta: {
    expiryDate: string;
    daysUntilExpiry: number;
    issuer: string;
    subject: string;
    validFrom: string;
    certState: 'healthy' | 'warning' | 'critical' | 'expired' | 'error';
  };
}

function getCertificate(host: string, port: number, timeout: number): Promise<tls.PeerCertificate> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();
        if (!cert || !cert.valid_to) {
          reject(new Error('No certificate returned'));
        } else {
          resolve(cert);
        }
      },
    );
    socket.setTimeout(timeout, () => {
      socket.destroy();
      reject(new Error(`Connection timed out after ${timeout}ms`));
    });
    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

export async function checkSslCert(host: string, options?: SslCertCheckOptions): Promise<SslCertCheckResult> {
  const port = options?.port ?? 443;
  const warningDays = options?.warningDays ?? 30;
  const criticalDays = options?.criticalDays ?? 14;
  const timeout = options?.timeout ?? 10000;
  const start = Date.now();

  try {
    const cert = await getCertificate(host, port, timeout);
    const ping = Date.now() - start;

    const expiryDate = new Date(cert.valid_to);
    const validFrom = new Date(cert.valid_from);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / 86400000);
    const issuer =
      (cert.issuer as Record<string, string> | undefined)?.O ??
      (cert.issuer as Record<string, string> | undefined)?.CN ??
      'Unknown';
    const subject = (cert.subject as Record<string, string> | undefined)?.CN ?? host;

    let certState: 'healthy' | 'warning' | 'critical' | 'expired';
    let status: boolean;
    let message: string;

    if (daysUntilExpiry <= 0) {
      certState = 'expired';
      status = false;
      message = `SSL EXPIRED: ${host} certificate expired ${Math.abs(daysUntilExpiry)} days ago`;
    } else if (daysUntilExpiry <= criticalDays) {
      certState = 'critical';
      status = false;
      message = `SSL CRITICAL: ${host} expires in ${daysUntilExpiry} days`;
    } else if (daysUntilExpiry <= warningDays) {
      certState = 'warning';
      status = true;
      message = `SSL WARNING: ${host} expires in ${daysUntilExpiry} days`;
    } else {
      certState = 'healthy';
      status = true;
      message = `SSL OK: ${host} certificate valid, expires in ${daysUntilExpiry} days`;
    }

    return {
      status,
      ping,
      message,
      meta: {
        expiryDate: expiryDate.toISOString(),
        daysUntilExpiry,
        issuer,
        subject,
        validFrom: validFrom.toISOString(),
        certState,
      },
    };
  } catch (err) {
    const ping = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: false,
      ping,
      message: `SSL check failed: ${message}`,
      meta: {
        expiryDate: '',
        daysUntilExpiry: 0,
        issuer: '',
        subject: '',
        validFrom: '',
        certState: 'error',
      },
    };
  }
}
