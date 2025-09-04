export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Redirect alternate domains to primary domain
    const alternativeDomains = ['areweipv6yet.net', 'areweipv6yet.org', 'arewev6yet.com'];
    const hostname = url.hostname.replace('www.', ''); // Strip www for comparison
    
    if (alternativeDomains.includes(hostname)) {
      // Redirect to primary domain, preserving path and query string
      const primaryUrl = new URL(url);
      primaryUrl.hostname = 'areweipv6yet.com';
      return Response.redirect(primaryUrl.toString(), 301);
    }
    
    // Redirect root to index.html
    if (url.pathname === '/') {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString(), request));
    }
    
    // Serve all other assets directly
    return env.ASSETS.fetch(request);
  }
};