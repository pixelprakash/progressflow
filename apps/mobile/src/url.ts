/**
 * http(s) URL parsing without the global `URL` — React Native's polyfill throws
 * "not implemented" for hostname/protocol/etc.
 */
export interface ParsedUrl {
  /** Normalised, with scheme, no trailing slash. */
  url: string;
  scheme: 'http' | 'https';
  host: string;
}

const RE =
  /^(https?):\/\/([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*)(:\d{1,5})?([/?#]\S*)?$/i;

export function parseHttpUrl(raw: string, assumeHttps = true): ParsedUrl | null {
  const t = raw.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : assumeHttps ? `https://${t}` : t;
  const m = RE.exec(withScheme);
  if (!m) return null;
  return {
    url: withScheme.replace(/\/+$/, ''),
    scheme: m[1]!.toLowerCase() as 'http' | 'https',
    host: m[2]!.toLowerCase(),
  };
}

/** Hosts where plain http is acceptable: this device, or a private network (dev servers). */
export function isPrivateHost(host: string): boolean {
  return (
    host === 'localhost' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}
