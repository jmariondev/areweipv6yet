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

// MX/NS live on the zone, not necessarily on the queried host (e.g.
// store.steampowered.com has neither) — walk up to parent domains.
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

export async function mxHosts(host) {
  const records = await resolveUp((d) => resolver.resolveMx(d), host);
  // RFC 7505 null MX ("0 .") means the domain explicitly takes no mail.
  return records.map((r) => r.exchange).filter((x) => x && x !== '.');
}

export function nsHosts(host) {
  return resolveUp((d) => resolver.resolveNs(d), host);
}
