// Decap CMS OAuth handler — Cloudflare Pages Function
// Routes: /api/auth, /api/callback, /api/token
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const { pathname, searchParams } = url;

  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const githubApi = 'https://github.com/login/oauth';

  const html = (body) => new Response(
    `<!doctype html><html><body>${body}<script>${''}</script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );

  if (pathname.endsWith('/api/auth')) {
    const state = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const redirect = `${url.origin}/api/callback`;
    const gh = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&scope=repo&state=${state}`;
    return Response.redirect(gh, 302);
  }

  if (pathname.endsWith('/api/callback')) {
    const code = searchParams.get('code');
    if (!code) return html('<p>Missing code.</p>');
    const tokenResp = await fetch(`${githubApi}/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const data = await tokenResp.json();
    const token = data.access_token;
    if (!token) return html(`<p>Auth failed: ${JSON.stringify(data)}</p>`);
    // hand token back to Decap via postMessage
    return new Response(
      `<!doctype html><html><body><script>
        (function(){
          var msg = JSON.stringify({ token: ${JSON.stringify(token)}, provider: 'github' });
          if (window.opener) {
            window.opener.postMessage('authorizing:github ' + msg, '*');
            document.body.innerHTML = '<p style="font:16px sans-serif;padding:40px">You are logged in. You can close this tab.</p>';
          } else {
            document.body.innerHTML = '<p style="font:16px sans-serif;padding:40px">No opener.</p>';
          }
        })();
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (pathname.endsWith('/api/token') && request.method === 'POST') {
    // Not used by implicit flow; keep minimal.
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response('Not found', { status: 404 });
}
