export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Define primary domain (without www)
    const primaryDomain = 'areweipv6yet.com';
    
    // Redirect all non-primary domains and all www variants to primary apex domain
    if (url.hostname !== primaryDomain) {
      // Redirect to primary apex domain, preserving path and query string
      const primaryUrl = new URL(url);
      primaryUrl.hostname = primaryDomain;
      return Response.redirect(primaryUrl.toString(), 301);
    }
    
    try {
      // Redirect root to index.html
      if (url.pathname === '/') {
        return await env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString(), request));
      }
      
      // Serve all other assets directly
      return await env.ASSETS.fetch(request);
    } catch (e) {
      // Return 404 for any errors (including missing files)
      return new Response('Not found', { status: 404 });
    }
  }
};
