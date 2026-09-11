import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * SSRF guard: this service fetches arbitrary user-supplied URLs from the
 * server, so it must never be allowed to reach internal/private network
 * ranges or cloud metadata endpoints (OWASP A10 - SSRF).
 */

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1']);

// CIDR ranges that must never be reachable from this server-side fetch.
const PRIVATE_V4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local / cloud metadata (169.254.169.254)
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4], // multicast
];

function ipToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => (acc << 8) + Number.parseInt(octet, 10), 0) >>> 0;
}

function isPrivateV4(ip: string): boolean {
  const ipInt = ipToInt(ip);
  return PRIVATE_V4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (ipInt & mask) === (ipToInt(base) & mask);
  });
}

function isPrivateV6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fe80:') || // link-local
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') || // unique local
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  );
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

function assertAddressIsPublic(address: string): void {
  const version = net.isIP(address);
  let isPrivate = false;
  if (version === 4) {
    isPrivate = isPrivateV4(address);
  } else if (version === 6) {
    isPrivate = isPrivateV6(address);
  }
  if (isPrivate) {
    throw new UnsafeUrlError('private_ip_address');
  }
}

async function resolveHostnameAddresses(hostname: string): Promise<string[]> {
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    return records.map((r) => r.address);
  } catch {
    throw new UnsafeUrlError('dns_resolution_failed');
  }
}

/**
 * Validates that `rawUrl` is a public http(s) URL and does not resolve to a
 * private/reserved/loopback address. Returns the parsed URL on success.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('invalid_url');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError('unsupported_protocol');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
    throw new UnsafeUrlError('blocked_hostname');
  }

  // If the hostname is already a literal IP, validate it directly.
  if (net.isIP(hostname)) {
    assertAddressIsPublic(hostname);
    return parsed;
  }

  // Otherwise resolve DNS and check every returned address. This does not
  // fully close DNS-rebinding (TOCTOU between this check and the actual
  // fetch), which is an accepted limitation for this MVP.
  const addresses = await resolveHostnameAddresses(hostname);
  if (addresses.length === 0) {
    throw new UnsafeUrlError('dns_resolution_failed');
  }
  addresses.forEach(assertAddressIsPublic);

  return parsed;
}
