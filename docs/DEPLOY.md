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

## Private surfaces — Cloudflare Access (REQUIRED before deploy)

Unlike the Editorial Office (dev-only, never built), the **Production Studio**
*is* part of the production build so it can live at a real URL. That means it is
**published to `dist/` and would be publicly reachable unless it is gated.**

### What the repo now enforces (in code)

A Cloudflare Pages **Function middleware fails closed** for the entire
`/production-studio` namespace on **every hostname** (production custom domain
*and* every `*.pages.dev` preview alias):

- `functions/_middleware.js` — boundary-safe prefix gate over `/production-studio`,
  `/production-studio/`, and `/production-studio/*` (lookalike public routes like
  `/production-studio-notes` are unaffected). Any request without a valid
  Cloudflare Access identity gets a **403**. It denies on missing config, missing
  token, invalid/expired token, or any verification error. **There is no preview
  bypass and no localhost bypass** — local work uses `npm run dev` / `npm run studio`,
  which never run this middleware.
- `functions/_lib/access.js` — the Pull Me Under Access JWT verifier (WebCrypto,
  RS256, audience + expiry), reused verbatim minus the preview bypass.
- Covered by `tests/access.test.mjs` (`npm test`).

Because the middleware denies when Access config is absent, a deploy that forgets
the steps below is **blocked, not exposed** — it fails closed.

### Remaining external steps (Cloudflare dashboard / env — cannot live in git)

1. **Set two environment variables in the Pages project, in BOTH scopes**
   (Settings → Environment variables → *Production* **and** *Preview*):
   - `ACCESS_TEAM_DOMAIN` — e.g. `luscioushoney.cloudflareaccess.com`
   - `ACCESS_AUD` — the Access application's **Application Audience (AUD) tag**
     (copied from the app in step 2). These are what the middleware verifies against.
2. **Create the Cloudflare Access application** for the production custom-domain
   `/production-studio` prefix. Either:
   - **One command:** `CF_API_TOKEN=… CF_ACCOUNT_ID=… node scripts/setup-access.mjs --apply`
     (token needs *Access: Apps and Policies: Edit*; dry-run without `--apply`; add
     teammates via `ACCESS_EMAILS="a@…,b@…"`), **or**
   - **Dashboard:** Zero Trust → Access → Applications → Add → **Self-hosted** →
     domain `luscioushoneycollective.com` path `/production-studio` (prefix match
     covers the hub, the Voice Notes Studio, and all its assets) → Policy: Allow
     `melody@melodyrash.com` (+ contributors).
3. **Preview-coverage decision (choose one):**
   - **(a) Cover previews with Access** — add the project's preview domain
     (`*.luscious-honey-collective.pages.dev`) to an Access application (or enable
     Access for preview deployments) so House members can reach the Studio on
     preview URLs. **or**
   - **(b) Leave previews hard-blocked** — do nothing extra. The middleware denies
     every `/production-studio*` request on `*.pages.dev` (no Access token is
     present there), so previews return 403 to everyone. Test locally instead.
   Either choice keeps previews non-public; (b) is the safe default.

Defence-in-depth also present: both pages carry
`<meta name="robots" content="noindex, nofollow">` and `robots.txt` disallows
`/production-studio`. **These are not security controls** — the middleware +
Access are the gate.

> If Access is not in place, treat `/production-studio*` as public and do **not**
> deploy the Studio.

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
