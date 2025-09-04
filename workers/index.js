import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle API endpoint
    if (url.pathname === '/api' || url.pathname === '/api.json') {
      // Read the api.json file from the built site
      try {
        const apiRequest = new Request(new URL('/api.json', request.url).toString());
        return await getAssetFromKV(
          {
            request: apiRequest,
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: assetManifest,
          }
        );
      } catch (e) {
        return new Response(JSON.stringify({
          message: "API endpoint - data would be served from KV/R2",
          timestamp: new Date().toISOString()
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }
    
    // Try to serve static assets
    try {
      // Default to index.html for root path
      let modifiedRequest = request;
      if (url.pathname === '/') {
        modifiedRequest = new Request(new URL('/index.html', request.url).toString());
      }
      
      return await getAssetFromKV(
        {
          request: modifiedRequest,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
    } catch (e) {
      // For 404s, return a proper 404 response
      return new Response('Not found', { status: 404 });
    }
  }
};