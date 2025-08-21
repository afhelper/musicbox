// Cloudflare Worker: Turnstile token verification endpoint
// - Supports local (test key) and production secrets via environment bindings
// - Add secrets:
//   wrangler secret put TURNSTILE_SECRET_PROD
//   wrangler secret put TURNSTILE_SECRET_TEST
// - Optional: configure allowed origins via ALLOWED_ORIGINS (comma separated)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname || '/';
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      console.log('[turnstile] OPTIONS', { path, origin });
      return handleOptions(request, env);
    }

    // Only serve on '/' or '/verify'
    if (path !== '/' && path !== '/verify') {
      return new Response('Not Found', { status: 404, headers: corsHeaders(request, env) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method Not Allowed' }, 405, corsHeaders(request, env));
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ success: false, error: 'Invalid JSON' }, 400, corsHeaders(request, env));
    }

    const token = body?.token;
    if (!token) {
      return json({ success: false, error: 'Missing token' }, 400, corsHeaders(request, env));
    }

    // Choose secret: localhost/127.* → TEST, otherwise PROD
    // 항상 운영 시크릿으로 검증 (로컬/운영 동일하게 실제 검증)
    const secret = env.TURNSTILE_SECRET_PROD; // Your real secret

    if (!secret) {
      return json({ success: false, error: 'Server misconfigured: missing secret' }, 500, corsHeaders(request, env));
    }

    console.log('[turnstile] POST verify:start', { path, origin });
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    // Optionally pass remoteip if available
    const cf = request.cf || {};
    if (cf && cf.clientTcpRtt) {
      // Not remoteip, kept for potential debugging
    }

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });

    const data = await result.json();
    console.log('[turnstile] POST verify:done', { success: !!data?.success, errors: data?.["error-codes"] });
    // Expected data: { success: boolean, "error-codes": [], action?: string, cdata?: string }

    const headers = corsHeaders(request, env);
    return json({ success: !!data?.success, raw: data }, 200, headers);
  },
};

function allowedOrigins(env) {
  // Comma-separated, e.g. "http://localhost:5500, http://127.0.0.1:5500, https://afhelper.github.io"
  const cfg = env.ALLOWED_ORIGINS || '';
  return cfg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origins = allowedOrigins(env);
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = origins.length === 0 ? '*' : (origins.includes(origin) ? origin : '');
  const headers = {
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin;
  return headers;
}

function handleOptions(request, env) {
  const headers = corsHeaders(request, env);
  return new Response(null, { status: 204, headers });
}

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}
