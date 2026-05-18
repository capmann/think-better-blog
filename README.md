# Think Better About — blog

Personal blog at [thinkbetterabout.ai](https://thinkbetterabout.ai). Built with Astro, deployed on Vercel.

## Commands

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Install dependencies                         |
| `npm run dev`     | Local dev server at `localhost:4321`         |
| `npm run build`   | Build production site to `./dist/`           |
| `npm run preview` | Preview the production build locally         |

## Writing posts

Two ways to write:

1. **In the browser via `/admin`** (no code, recommended). Sveltia CMS UI at [thinkbetterabout.ai/admin](https://thinkbetterabout.ai/admin). Sign in with GitHub. Create posts, save as draft, publish.
2. **Locally via markdown files**, in `src/content/blog/*.md`. Frontmatter schema in `src/content.config.ts`.

Drafts (`draft: true` in frontmatter) are hidden everywhere on the live site: home, `/blog`, tag pages, RSS, sitemap.

## One-time setup for `/admin`

The admin uses GitHub OAuth so only the repo owner can sign in. To wire it up:

### 1. Create a GitHub OAuth App

Go to [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**.

- **Application name**: `Think Better About CMS`
- **Homepage URL**: `https://thinkbetterabout.ai`
- **Authorization callback URL**: `https://thinkbetterabout.ai/api/callback`

After creating, click **Generate a new client secret**. Copy the client ID and the secret.

### 2. Add env vars on Vercel

In the Vercel project → **Settings** → **Environment Variables**, add three vars to **Production** (and Preview if you want to use the admin from preview deployments):

| Name                    | Value                                                    |
| :---------------------- | :------------------------------------------------------- |
| `GITHUB_CLIENT_ID`      | from the OAuth App                                       |
| `GITHUB_CLIENT_SECRET`  | from the OAuth App                                       |
| `OAUTH_STATE_SECRET`    | any long random string (e.g. `openssl rand -hex 32`)     |
| `GITHUB_ALLOWED_USERS`  | `capmann` (comma-separated GitHub usernames allowed in)  |

Then redeploy so the new env vars are picked up.

### 3. Sign in

Visit `/admin`, click **Sign in with GitHub**, approve the OAuth app. You should land in the editor.

## Stack notes

- Astro v6 with MDX, sitemap, RSS
- Vercel auto-deploys on push to `main`
- `/api/auth.js` and `/api/callback.js` are Vercel Node functions handling the OAuth flow
- `public/admin/` mounts Sveltia CMS (loaded from the unpkg CDN)
- Theme based on [Bear Blog](https://github.com/HermanMartinus/bearblog/)
