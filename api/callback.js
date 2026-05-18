// GitHub OAuth: handle the callback.
// 1. Verify the signed state.
// 2. Exchange the code for an access token.
// 3. Confirm the GitHub user is on the allowlist.
// 4. Render an HTML page that posts the token back to the CMS opener.

import crypto from 'node:crypto';

const STATE_TTL_MS = 10 * 60 * 1000;

function verifyState(state, secret) {
	if (!state || typeof state !== 'string') return false;
	const parts = state.split('.');
	if (parts.length !== 3) return false;
	const [nonce, issued, sig] = parts;
	const payload = `${nonce}.${issued}`;
	const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
	const sigBuf = Buffer.from(sig, 'hex');
	const expBuf = Buffer.from(expected, 'hex');
	if (sigBuf.length !== expBuf.length) return false;
	if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
	const issuedAt = Number.parseInt(issued, 10);
	if (!Number.isFinite(issuedAt)) return false;
	if (Date.now() - issuedAt > STATE_TTL_MS) return false;
	return true;
}

function escapeJsForScript(value) {
	return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function renderResponseHtml({ status, payload }) {
	// Decap/Sveltia handshake:
	// 1. Wait for the opener to send "authorizing:github".
	// 2. Reply with "authorization:github:<status>:<json>".
	const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
	return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Authorizing…</title></head>
<body style="font-family: system-ui, sans-serif; padding: 2rem;">
<p>Authorizing… you can close this window.</p>
<script>
(function () {
	var message = ${escapeJsForScript(message)};
	function receive(event) {
		if (!event.data || typeof event.data !== 'string') return;
		if (event.data.indexOf('authorizing:github') !== 0) return;
		event.source.postMessage(message, event.origin);
		window.removeEventListener('message', receive, false);
	}
	window.addEventListener('message', receive, false);
	if (window.opener) {
		window.opener.postMessage('sveltia-cms-auth:ready', '*');
	}
})();
</script>
</body>
</html>`;
}

export default async function handler(req, res) {
	const clientId = process.env.GITHUB_CLIENT_ID;
	const clientSecret = process.env.GITHUB_CLIENT_SECRET;
	const stateSecret = process.env.OAUTH_STATE_SECRET;
	const allowlistRaw = process.env.GITHUB_ALLOWED_USERS || '';
	const allowlist = allowlistRaw.split(',').map((u) => u.trim().toLowerCase()).filter(Boolean);

	res.setHeader('Cache-Control', 'no-store');
	res.setHeader('Content-Type', 'text/html; charset=utf-8');

	if (!clientId || !clientSecret || !stateSecret) {
		res.status(500).send(renderResponseHtml({
			status: 'error',
			payload: { message: 'OAuth not configured on the server.' },
		}));
		return;
	}

	const url = new URL(req.url, `https://${req.headers.host}`);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (!code) {
		res.status(400).send(renderResponseHtml({
			status: 'error',
			payload: { message: 'Missing authorization code.' },
		}));
		return;
	}

	if (!verifyState(state, stateSecret)) {
		res.status(400).send(renderResponseHtml({
			status: 'error',
			payload: { message: 'Invalid or expired state.' },
		}));
		return;
	}

	let tokenJson;
	try {
		const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				client_id: clientId,
				client_secret: clientSecret,
				code,
			}),
		});
		tokenJson = await tokenRes.json();
	} catch (err) {
		res.status(502).send(renderResponseHtml({
			status: 'error',
			payload: { message: 'Failed to reach GitHub token endpoint.' },
		}));
		return;
	}

	const token = tokenJson?.access_token;
	if (!token) {
		res.status(400).send(renderResponseHtml({
			status: 'error',
			payload: { message: tokenJson?.error_description || 'No access token returned.' },
		}));
		return;
	}

	if (allowlist.length > 0) {
		try {
			const userRes = await fetch('https://api.github.com/user', {
				headers: {
					Authorization: `token ${token}`,
					'User-Agent': 'think-better-blog-cms',
					Accept: 'application/vnd.github+json',
				},
			});
			const user = await userRes.json();
			const login = (user?.login || '').toLowerCase();
			if (!login || !allowlist.includes(login)) {
				res.status(403).send(renderResponseHtml({
					status: 'error',
					payload: { message: 'This GitHub account is not allowed to access the CMS.' },
				}));
				return;
			}
		} catch (err) {
			res.status(502).send(renderResponseHtml({
				status: 'error',
				payload: { message: 'Failed to verify GitHub user.' },
			}));
			return;
		}
	}

	res.status(200).send(renderResponseHtml({
		status: 'success',
		payload: { token, provider: 'github' },
	}));
}
