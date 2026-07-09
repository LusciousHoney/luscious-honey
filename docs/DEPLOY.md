# Deployment — Cloudflare Pages

The Headquarters deploys to **Cloudflare Pages** as its own project, **separate
from Pull Me Under** (which deploys from its own GitHub repo → `pullmeunder`
project). This project uses **Wrangler Direct Upload** (no GitHub repo required).

- **Pages project:** `luscious-honey-collective`
- **Default URL:** `https://luscious-honey-collective.pages.dev`
- **Custom domain:** `luscioushoneycollective.com`
- **Account:** melody@melodyrash.com (`ac0a7497…`)
- **Config:** [`wrangler.toml`](../wrangler.toml) (`name`, `pages_build_output_dir = "dist"`)

## One-time setup (already done)

```bash
npm install                        # installs wrangler (devDependency)
npx wrangler login                 # browser OAuth — already logged in on this machine
npx wrangler pages project create luscious-honey-collective --production-branch=main
```

## Deploy (repeat for every release)

```bash
npm run deploy      # = npm run verify (build + tests + fixture-safety) && wrangler pages deploy
```

`wrangler pages deploy` reads `name` and `pages_build_output_dir` from
`wrangler.toml`, so no arguments are needed. It uploads `dist/`.

### Safety guarantees baked into the deploy

- `npm run verify` runs first: build + 23 tests + the production fixture-safety
  check. A failing check aborts the deploy.
- The **Editorial Office is never deployed** — `editorial-office.html` is not a
  Vite build input, so it is absent from `dist/`. (Verified: requesting
  `/editorial-office.html` on the live site serves the public homepage, never the
  Office.)
- Production ships `data-env="production"`, so no fixture labels are visible.

## Verify a deployment

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://luscious-honey-collective.pages.dev/
for p in "" publishing reader press; do curl -sS -o /dev/null -w "/$p %{http_code}\n" "https://luscioushoneycollective.com/$p"; done
```

## Custom domain

`luscioushoneycollective.com` is an **active zone in the same Cloudflare account**,
so its DNS + TLS are managed automatically — no DNS records are typed by hand.

**Attach it via the dashboard** (the Wrangler OAuth token has `pages:write` but not
`dns_records:write`, so it cannot create the DNS record from the CLI; the dashboard
creates it for you automatically):

1. **dash.cloudflare.com** → your account.
2. Left sidebar → **Workers & Pages** (newer nav: **Compute (Workers)**).
3. Open the **`luscious-honey-collective`** project → **Custom domains** tab.
4. **Set up a custom domain** → enter `luscioushoneycollective.com` → **Continue**.
5. Because the zone is in this account, Cloudflare shows the CNAME it will add for
   you → **Activate domain**. (Do **not** add a DNS record by hand.)
6. Status goes **Active** in a few minutes (DNS + Google-managed cert).

Optionally repeat for `www.luscioushoneycollective.com` (or add a redirect).

> Note: unmatched paths currently serve the homepage (index fallback) with `200`
> rather than a `404`. This is cosmetic; if a true 404 is wanted later, add a
> `dist/404.html` (via `public/404.html`) or set the project's not-found handling.
