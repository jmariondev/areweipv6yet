// Derive the hostnames to check from a service URL.
//
// - https://www.example.com  -> apex "example.com" + www "www.example.com"
// - https://example.com      -> apex "example.com" + www "www.example.com"
// - https://store.example.com (deeper subdomain) -> that host only, no www
export function variantsOf(urlStr) {
  const { hostname } = new URL(urlStr);

  if (hostname.startsWith('www.')) {
    return { apex: hostname.slice(4), www: hostname };
  }

  if (hostname.split('.').length > 2) {
    return { apex: hostname, www: null };
  }

  return { apex: hostname, www: `www.${hostname}` };
}
