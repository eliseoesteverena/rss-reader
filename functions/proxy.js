/**
 * Cloudflare Pages Function: /functions/proxy.js
 * Route: /proxy?url=<encoded_feed_url>
 *
 * Fetches any RSS/Atom feed server-side and returns it with CORS headers,
 * so the browser never makes a cross-origin request directly.
 */

export async function onRequest(context) {
  const { request } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const { searchParams } = new URL(request.url);
  const feedUrl = searchParams.get('url');

  if (!feedUrl) {
    return jsonError(400, 'Missing "url" query parameter.');
  }

  // Basic URL validation
  let parsed;
  try {
    parsed = new URL(feedUrl);
  } catch {
    return jsonError(400, 'Invalid URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return jsonError(400, 'Only http and https URLs are allowed.');
  }

  try {
    const upstream = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      redirect: 'follow',
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/xml; charset=utf-8';

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders(),
      },
    });
  } catch (err) {
    return jsonError(502, `Failed to fetch feed: ${err.message}`);
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
