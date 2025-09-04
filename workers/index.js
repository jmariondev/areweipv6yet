/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Force HTTPS redirect
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    
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
      let response;
      if (url.pathname === '/') {
        response = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString(), request));
      } else {
        // Serve all other assets directly
        response = await env.ASSETS.fetch(request);
      }
      
      // Clone response to add headers
      response = new Response(response.body, response);
      
      // Add comprehensive security headers
      const headers = new Headers(response.headers);
      
      // Content Security Policy - strict policy
      headers.set('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests"
      ].join('; '));
      
      // Other security headers
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Frame-Options', 'DENY');
      headers.set('X-XSS-Protection', '1; mode=block');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      headers.set('Cache-Control', 'public, max-age=86400, must-revalidate');
      
      // HSTS (HTTP Strict Transport Security)
      headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });
    } catch (e) {
      // Return 404 for any errors (including missing files)
      return new Response('Not found', { status: 404 });
    }
  }
};
