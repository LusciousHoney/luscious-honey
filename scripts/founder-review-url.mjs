#!/usr/bin/env node
/**
 * Founder Review mode — the Access-protected Executive Headquarters review link.
 *
 * Prints the exact preview URL that lands on the Executive Office (where the
 * feature under review lives), so the Founder never has to hunt for the URL or
 * remember the private route.
 *
 * ─── SECURITY ───────────────────────────────────────────────────────────────
 * This is a LOCAL, READ-ONLY report helper. It is NOT part of the site build
 * (scripts/ is not a Vite input), is never bundled into `dist`, and is never
 * deployed. It performs NO network calls and reads NO credentials — it only
 * derives a URL string from a branch name. It:
 *   • never deploys, rebuilds, promotes, or changes any Cloudflare/GitHub setting
 *   • never weakens production security and adds no public bypass
 *   • adds no code or shortcut to the shipped product
 * The URL it prints is protected by Cloudflare Access exactly like production —
 * `/headquarters` stays gated by the "Production Studio (private)" Access app in
 * every environment (preview and production both set ACCESS_TEAM_DOMAIN /
 * ACCESS_AUD). Handing someone this URL is not a bypass: they must still
 * authenticate through Access to load the page.
 *
 * How the URL is derived: Cloudflare Pages gives every branch a stable preview
 * alias `<slug>.<project>.pages.dev`, where <slug> is the branch name lowercased,
 * with non-alphanumeric runs collapsed to "-" and truncated to 28 characters.
 * We append the `/headquarters/` route (the Executive Office, SPA hash route #/).
 *
 * Usage:
 *   node scripts/founder-review-url.mjs [branch]     # default: current git branch
 *   node scripts/founder-review-url.mjs --json        # machine-readable
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROUTE = '/headquarters/'; // Executive Office (SPA default hash route #/)
const ALIAS_MAX = 28; // Cloudflare Pages branch-alias subdomain segment limit
const asJson = process.argv.includes('--json');
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));

function projectName() {
  try {
    const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
    return (toml.match(/^\s*name\s*=\s*"([^"]+)"/m) || [])[1] || 'luscious-honey-collective';
  } catch {
    return 'luscious-honey-collective';
  }
}

function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return '';
  }
}

/** Cloudflare Pages branch → preview alias slug (deterministic, offline). */
function branchAlias(branch) {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')   // non-alphanumeric runs → single hyphen
    .replace(/^-+|-+$/g, '')       // trim leading/trailing hyphens
    .slice(0, ALIAS_MAX)
    .replace(/-+$/g, '');          // trim any hyphen left dangling by truncation
}

const branch = positional[0] || currentBranch();
if (!branch) {
  console.error('founder-review-url: no branch given and could not read the current git branch.');
  process.exit(1);
}
if (branch === 'main' || branch === 'master') {
  console.error(`founder-review-url: "${branch}" is the production branch, not a review preview.`);
  console.error(`  Production (Access-protected): https://${projectName()}.pages.dev${ROUTE}`);
  process.exit(1);
}

const project = projectName();
const reviewUrl = `https://${branchAlias(branch)}.${project}.pages.dev${ROUTE}`;

if (asJson) {
  console.log(JSON.stringify({ reviewUrl, route: ROUTE, branch, project, accessProtected: true }, null, 2));
} else {
  console.log('');
  console.log('  Founder Review — Executive Headquarters preview');
  console.log('  ------------------------------------------------');
  console.log(`  Review URL : ${reviewUrl}`);
  console.log(`  Route      : ${ROUTE}  (Executive Office, #/)`);
  console.log(`  Branch     : ${branch}`);
  console.log('  Access     : Cloudflare Access required — "Production Studio (private)".');
  console.log('               Production security unchanged; /headquarters stays protected.');
  console.log('               (Confirm the live preview exists in the Cloudflare Pages dashboard.)');
  console.log('');
}
