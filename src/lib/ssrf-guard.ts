import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF guard: this service fetches arbitrary user-supplied URLs from the
 * server, so it must never be allowed to reach internal/private network
 * ranges or cloud metadata endpoints (OWASP A10 - SSRF).
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);
const blocked = new net.BlockList();
for (const [address, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["192.0.2.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, bits, "ipv4");
for (const [address, bits] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const)
  blocked.addSubnet(address, bits, "ipv6");

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function assertAddressIsPublic(address: string): void {
  const version = net.isIP(address);
  if (!version || blocked.check(address, version === 4 ? "ipv4" : "ipv6"))
    throw new UnsafeUrlError("private_ip_address");
}

async function resolveHostnameAddresses(hostname: string): Promise<string[]> {
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    return records.map((r) => r.address);
  } catch {
    throw new UnsafeUrlError("dns_resolution_failed");
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
    throw new UnsafeUrlError("invalid_url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError("unsupported_protocol");
  }

  if (
    parsed.username ||
    parsed.password ||
    (parsed.port && !["80", "443"].includes(parsed.port))
  )
    throw new UnsafeUrlError("unsupported_url");
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local")) {
    throw new UnsafeUrlError("blocked_hostname");
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
    throw new UnsafeUrlError("dns_resolution_failed");
  }
  addresses.forEach(assertAddressIsPublic);

  return parsed;
}
