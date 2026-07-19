# Founder Review Mode — Headquarters previews

**Purpose.** When a Headquarters feature PR is open, get straight to the feature
without hunting for the URL or remembering the private route.

**Approach: Option A — the exact Access-protected review link, provided up front.**
No product code changes, no new runtime, no security change. The only thing that
was ever wrong was landing on `/` (public Reception) instead of `/headquarters/`.
The fix is simply to always hand over the correct deep link.

## The link

Every branch gets a stable Cloudflare Pages preview alias. The Executive Office
(where features under review render) lives at the `/headquarters/` route:

```
https://<branch-alias>.luscious-honey-collective.pages.dev/headquarters/
```

Generate it for any branch (offline, no credentials, no network):

```
npm run review:url                       # current branch
npm run review:url <branch-name>         # a specific branch
node scripts/founder-review-url.mjs --json <branch-name>
```

The alias is derived deterministically: branch name lowercased, non-alphanumeric
runs collapsed to `-`, truncated to 28 characters. Example:
`feature/eos-m1-founder-attention` → `feature-eos-m1-founder-atten`.

**Convention:** every Headquarters-feature-PR completion report includes this
review URL, so the link is always one click away.

## Why this is the safest long-term workflow

- **Nothing about security changes.** `/headquarters` stays gated by the
  "Production Studio (private)" Cloudflare Access application in **both** preview
  and production (both set `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD`). The reviewer must
  still authenticate through Access to load the page.
- **No public bypass.** The URL is not a secret and is not a shortcut — it is the
  normal Access-protected route. Sharing it grants nothing that Access does not.
- **No production footprint.** The helper is a local report tool: `scripts/` is
  not a Vite input, so it is never bundled into `dist` and never deployed. There
  is no review shortcut, flag, or redirect living in the shipped product.
- **Once at `/headquarters/`, Access does the rest.** Because the link targets the
  protected route directly, Cloudflare Access challenges immediately and returns
  the Founder to the Executive Office after sign-in — no landing on Reception.
  (This is why Option B's "auto-open after auth" is unnecessary, and why Option
  C's preview-only in-app redirect — extra shipped code that must be proven inert
  in production — is avoided.)

## What was considered and rejected

- **Option B (redirect Reception → Headquarters after auth):** Reception is public
  and holds no Access identity, so it cannot know whether the visitor is
  authenticated without new coupling; it would also change production behavior.
  Solved for free by linking to `/headquarters/` directly.
- **Option C (preview-only in-app review redirect):** adds code to the bundle that
  must be environment-gated and provably inert in production every release — more
  surface and a latent risk, for no benefit over Option A.
