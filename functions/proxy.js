/**
 * Cloudflare Pages Function: /functions/proxy.js
 * Route: /proxy?url=<encoded_url>
 *
 * Fetches RSS feeds or full HTML pages server-side and returns them
 * with CORS headers. Spoofs browser headers to avoid WAF blocks.
 */

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) return jsonError(400, 'Missing "url" parameter.');

  let parsed;
  try { parsed = new URL(targetUrl); }
  catch { return jsonError(400, 'Invalid URL.'); }

  if (!['http:', 'https:'].includes(parsed.protocol))
    return jsonError(400, 'Only http/https allowed.');

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Referer': `${parsed.protocol}//${parsed.hostname}/`,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
      redirect: 'follow',
      cf: { cacheTtl: 180, cacheEverything: true },
    });

    if (!upstream.ok) return jsonError(upstream.status, `Upstream error: ${upstream.status}`);

    const body = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'text/html; charset=utf-8';

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=180',
        ...corsHeaders(),
      },
    });
  } catch (err) {
    return jsonError(502, `Fetch failed: ${err.message}`);
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
