// Redirect the alternate domains (www.areweipv6yet.com, areweipv6yet.net/.org,
// arewev6yet.com) to the canonical host. The primary domain is served by the
// assets-only Worker in wrangler.toml, where public/_headers applies.
export default {
  fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'areweipv6yet.com';
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  },
};
