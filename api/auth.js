// GitHub OAuth: start the flow.
// Sveltia CMS opens a popup to /api/auth?provider=github&scope=repo&site_id=...
// We redirect to GitHub's authorize URL with a signed state.

import crypto from 'node:crypto';

const STATE_TTL_MS = 10 * 60 * 1000;

function sign(value, secret) {
	return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export default function handler(req, res) {
	const clientId = process.env.GITHUB_CLIENT_ID;
	const stateSecret = process.env.OAUTH_STATE_SECRET;

	if (!clientId || !stateSecret) {
		res.status(500).send('OAuth not configured: missing GITHUB_CLIENT_ID or OAUTH_STATE_SECRET.');
		return;
	}

	const url = new URL(req.url, `https://${req.headers.host}`);
	const provider = url.searchParams.get('provider') || 'github';
	if (provider !== 'github') {
		res.status(400).send('Unsupported provider.');
		return;
	}

	const scope = url.searchParams.get('scope') || 'repo,user';
	const nonce = crypto.randomBytes(16).toString('hex');
	const issued = Date.now().toString();
	const payload = `${nonce}.${issued}`;
	const state = `${payload}.${sign(payload, stateSecret)}`;

	const redirectUri = `https://${req.headers.host}/api/callback`;
	const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
	authorizeUrl.searchParams.set('client_id', clientId);
	authorizeUrl.searchParams.set('redirect_uri', redirectUri);
	authorizeUrl.searchParams.set('scope', scope);
	authorizeUrl.searchParams.set('state', state);
	authorizeUrl.searchParams.set('allow_signup', 'false');

	res.setHeader('Cache-Control', 'no-store');
	res.writeHead(302, { Location: authorizeUrl.toString() });
	res.end();
}

export { STATE_TTL_MS };
