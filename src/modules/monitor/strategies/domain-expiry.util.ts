export interface DomainExpiryCheckOptions {
  warningDays?: number;
  criticalDays?: number;
  timeout?: number;
}

export interface DomainExpiryCheckResult {
  status: boolean;
  ping: number;
  message: string;
  meta: {
    expiryDate: string | null;
    daysUntilExpiry: number | null;
    registrar: string | null;
    lookupSource: 'rdap';
    domainState: 'healthy' | 'warning' | 'critical' | 'expired' | 'error' | 'unsupported';
  };
}

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

interface RdapVcardEntry {
  0: string;
  3: string;
}

interface RdapEntity {
  roles: string[];
  vcardArray?: [string, RdapVcardEntry[]];
}

interface RdapResponse {
  events?: RdapEvent[];
  entities?: RdapEntity[];
}

export async function checkDomainExpiry(domain: string, options?: DomainExpiryCheckOptions): Promise<DomainExpiryCheckResult> {
  const warningDays = options?.warningDays ?? 30;
  const criticalDays = options?.criticalDays ?? 14;
  const timeout = options?.timeout ?? 10000;
  const start = Date.now();

  try {
    const response = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: AbortSignal.timeout(timeout),
      headers: { Accept: 'application/json' },
    });
    const ping = Date.now() - start;

    if (response.status === 404) {
      return {
        status: false,
        ping,
        message: `DOMAIN: RDAP not supported for ${domain} (TLD may not be in RDAP bootstrap)`,
        meta: {
          expiryDate: null,
          daysUntilExpiry: null,
          registrar: null,
          lookupSource: 'rdap',
          domainState: 'unsupported',
        },
      };
    }

    if (!response.ok) {
      return {
        status: false,
        ping,
        message: `DOMAIN lookup failed for ${domain}: HTTP ${response.status}`,
        meta: {
          expiryDate: null,
          daysUntilExpiry: null,
          registrar: null,
          lookupSource: 'rdap',
          domainState: 'error',
        },
      };
    }

    const data = (await response.json()) as RdapResponse;

    const expiryEvent = data.events?.find((e) => e.eventAction === 'expiration');
    if (!expiryEvent?.eventDate) {
      return {
        status: false,
        ping,
        message: `DOMAIN lookup failed for ${domain}: no expiry date in RDAP response`,
        meta: {
          expiryDate: null,
          daysUntilExpiry: null,
          registrar: null,
          lookupSource: 'rdap',
          domainState: 'error',
        },
      };
    }

    const expiryDate = new Date(expiryEvent.eventDate);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / 86400000);

    const registrarEntity = data.entities?.find((e) => e.roles.includes('registrar'));
    const registrar = registrarEntity?.vcardArray?.[1]?.find((entry) => entry[0] === 'fn')?.[3] ?? null;

    let domainState: 'healthy' | 'warning' | 'critical' | 'expired';
    let status: boolean;
    let message: string;

    if (daysUntilExpiry <= 0) {
      domainState = 'expired';
      status = false;
      message = `DOMAIN EXPIRED: ${domain} expired ${Math.abs(daysUntilExpiry)} days ago`;
    } else if (daysUntilExpiry <= criticalDays) {
      domainState = 'critical';
      status = false;
      message = `DOMAIN CRITICAL: ${domain} expires in ${daysUntilExpiry} days`;
    } else if (daysUntilExpiry <= warningDays) {
      domainState = 'warning';
      status = true;
      message = `DOMAIN WARNING: ${domain} expires in ${daysUntilExpiry} days`;
    } else {
      domainState = 'healthy';
      status = true;
      message = `DOMAIN OK: ${domain} expires in ${daysUntilExpiry} days`;
    }

    return {
      status,
      ping,
      message,
      meta: {
        expiryDate: expiryDate.toISOString(),
        daysUntilExpiry,
        registrar,
        lookupSource: 'rdap',
        domainState,
      },
    };
  } catch (err) {
    const ping = Date.now() - start;
    const reason = err instanceof Error ? err.message : String(err);
    return {
      status: false,
      ping,
      message: `DOMAIN lookup failed for ${domain}: ${reason}`,
      meta: {
        expiryDate: null,
        daysUntilExpiry: null,
        registrar: null,
        lookupSource: 'rdap',
        domainState: 'error',
      },
    };
  }
}
