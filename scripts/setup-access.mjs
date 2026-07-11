/* =============================================================================
   CLOUDFLARE ACCESS — provision the gate for /production-studio*
   -----------------------------------------------------------------------------
   The Production Studio ships in the production build, so it MUST be gated by
   Cloudflare Access or it is public. This script creates a self-hosted Access
   application covering `luscioushoneycollective.com/production-studio` (and every
   path beneath it) with an allow-policy for the House emails.

   It is the SINGLE remaining manual step of the migration — a code-prepared
   alternative to clicking through the dashboard (docs/DEPLOY.md).

   SAFETY: dry-run by default. It prints exactly what it would create and does
   NOT change anything unless you pass `--apply`.

   Usage:
     CF_API_TOKEN=…  CF_ACCOUNT_ID=…  node scripts/setup-access.mjs           # dry-run (preview)
     CF_API_TOKEN=…  CF_ACCOUNT_ID=…  node scripts/setup-access.mjs --apply    # actually create

   Env:
     CF_API_TOKEN    Cloudflare API token with "Access: Apps and Policies: Edit".
     CF_ACCOUNT_ID   Cloudflare account id (see docs/DEPLOY.md — ac0a7497…).
     ACCESS_EMAILS   Optional, comma-separated allow-list.
                     Default: melody@melodyrash.com
   ============================================================================= */

const APPLY = process.argv.includes('--apply');
const API = 'https://api.cloudflare.com/client/v4';

const token = process.env.CF_API_TOKEN;
const account = process.env.CF_ACCOUNT_ID;
const emails = (process.env.ACCESS_EMAILS || 'melody@melodyrash.com')
  .split(',').map((s) => s.trim()).filter(Boolean);

const DOMAIN = 'luscioushoneycollective.com/production-studio'; // path-prefix match covers /production-studio*
const APP_NAME = 'Production Studio (private)';

function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }

if (!token || !account) {
  die(
    'Missing CF_API_TOKEN and/or CF_ACCOUNT_ID.\n' +
    '  Create a token with "Access: Apps and Policies: Edit", then re-run:\n' +
    '    CF_API_TOKEN=…  CF_ACCOUNT_ID=…  node scripts/setup-access.mjs        (dry-run)\n' +
    '    CF_API_TOKEN=…  CF_ACCOUNT_ID=…  node scripts/setup-access.mjs --apply (create)\n' +
    '  Or configure it in the dashboard — see docs/DEPLOY.md.',
  );
}

const appPayload = {
  name: APP_NAME,
  domain: DOMAIN,
  type: 'self_hosted',
  session_duration: '24h',
};
const policyPayload = {
  name: 'House members',
  decision: 'allow',
  include: [{ email: { email: emails[0] } }].concat(
    emails.slice(1).map((e) => ({ email: { email: e } })),
  ),
};

console.log('Cloudflare Access — Production Studio gate');
console.log('  account   :', account);
console.log('  domain    :', DOMAIN, '(matches /production-studio and everything under it)');
console.log('  allow     :', emails.join(', '));
console.log('  mode      :', APPLY ? 'APPLY (will create)' : 'dry-run (no changes)');

if (!APPLY) {
  console.log('\nDry-run only. Re-run with --apply to create the application + policy.');
  process.exit(0);
}

async function cf(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    die(`Cloudflare API error on ${path}: ${JSON.stringify(json.errors || json)}`);
  }
  return json.result;
}

const app = await cf(`/accounts/${account}/access/apps`, appPayload);
console.log(`\n✓ Access application created (id ${app.id}).`);
await cf(`/accounts/${account}/access/apps/${app.id}/policies`, policyPayload);
console.log('✓ Allow-policy attached. /production-studio* is now gated.');
