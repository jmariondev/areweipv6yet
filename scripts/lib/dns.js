import { Resolver } from 'node:dns/promises';

const resolver = new Resolver({ timeout: 5000, tries: 2 });

// "No records" is a result, not an error; anything else (timeout, SERVFAIL)
// propagates so callers can skip the update instead of recording a false.
const isNoRecords = (err) => err.code === 'ENODATA' || err.code === 'ENOTFOUND';

export async function hasAAAA(host) {
  try {
    return (await resolver.resolve6(host)).length > 0;
  } catch (err) {
    if (isNoRecords(err)) return false;
    throw err;
  }
}

export async function hasA(host) {
  try {
    return (await resolver.resolve4(host)).length > 0;
  } catch (err) {
    if (isNoRecords(err)) return false;
    throw err;
  }
}

// NS records live on the enclosing zone, not necessarily on the queried
// host (e.g. store.steampowered.com has none) — walk up to parent domains.
async function resolveUp(resolve, host) {
  let labels = host.split('.');
  while (labels.length >= 2) {
    try {
      const records = await resolve(labels.join('.'));
      if (records.length > 0) return records;
    } catch (err) {
      if (!isNoRecords(err)) throw err;
    }
    labels = labels.slice(1);
  }
  return [];
}

// MX is host-specific, not zone-inherited: mail for aws.amazon.com uses that
// exact name's MX — amazon.com's MX belongs to a different service. No
// records means the host takes no mail, which is not an IPv6 gap.
export async function mxHosts(host) {
  let records;
  try {
    records = await resolver.resolveMx(host);
  } catch (err) {
    if (isNoRecords(err)) return [];
    throw err;
  }
  // RFC 7505 null MX ("0 .") means the domain explicitly takes no mail.
  return records.map((r) => r.exchange).filter((x) => x && x !== '.');
}

export function nsHosts(host) {
  return resolveUp((d) => resolver.resolveNs(d), host);
}
