/* =============================================================================
   CREATE INVITATION — administrative token minting for the invitation registry.

   Generates a cryptographically strong private token, stores ONLY its SHA-256
   hash in D1 (never the raw token), and prints the private URL exactly once for
   the Founder. The raw token is never written to a file, a log, or the database.

   Usage:
     node scripts/create-invitation.mjs \
       --recipient "DaVonna" --slug davonna [--proposal founding-steward] \
       [--base-url https://luscioushoneycollective.com] \
       [--expires "2026-12-31 23:59:59"] [--local | --remote] [--force]

   • --local   apply to the local D1 shadow (dev)         [default]
     --remote  apply to the live D1 database (production)
   • --force   re-issue: replace an existing invitation for this slug with a fresh
               token and reset its lifecycle. Without it, an existing slug is
               refused so a duplicate active invitation is never created by accident.

   The hashing here MUST match functions/_lib/invitation.js#hashToken (SHA-256 hex).
   ============================================================================= */

import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';

const DB = 'lhc-hq';

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const recipient = arg('recipient');
const slug = arg('slug');
const proposalId = arg('proposal', 'founding-steward');
const baseUrl = (arg('base-url', '') || '').replace(/\/+$/, '');
const expiresAt = arg('expires', null);
const remote = flag('remote');
const scopeFlag = remote ? '--remote' : '--local';
const force = flag('force');

if (!recipient || !slug) {
  console.error('Missing required --recipient and/or --slug.');
  console.error('e.g. node scripts/create-invitation.mjs --recipient "DaVonna" --slug davonna --remote');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error('--slug must be lowercase letters, numbers, and hyphens only.');
  process.exit(1);
}

const KNOWN_PROPOSALS = new Set(['founding-steward']);
if (!KNOWN_PROPOSALS.has(proposalId)) {
  console.error(`Unknown --proposal "${proposalId}". Known: ${[...KNOWN_PROPOSALS].join(', ')}.`);
  process.exit(1);
}

// SQL string literal escaping (double any single quote). Values are Founder-supplied.
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function d1(sql) {
  // --json gives a parseable result; stdout carries only query results, not the token.
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, scopeFlag, '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  try {
    const parsed = JSON.parse(out);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    return (first && first.results) || [];
  } catch {
    return [];
  }
}

// Duplicate guard.
const existing = d1(`SELECT id, status FROM invitations WHERE recipient_slug = ${q(slug)};`);
if (existing.length && !force) {
  console.error(`An invitation for slug "${slug}" already exists (status: ${existing[0].status}).`);
  console.error('Refusing to create a duplicate. Re-run with --force to re-issue a fresh token for this slug.');
  process.exit(1);
}

// Mint the token and its hash. The raw token lives only in this process's memory
// and is printed once at the end; only the hash is persisted.
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');
const id = `inv_${randomBytes(8).toString('hex')}`;
const expiresSql = expiresAt ? q(expiresAt) : 'NULL';

if (existing.length && force) {
  // Re-issue: fresh token + reset lifecycle for the existing slug.
  d1(
    `UPDATE invitations
        SET token_hash = ${q(tokenHash)}, proposal_id = ${q(proposalId)},
            recipient_name = ${q(recipient)}, status = 'invited',
            opened_at = NULL, accepted_at = NULL, notified_at = NULL,
            expires_at = ${expiresSql}
      WHERE recipient_slug = ${q(slug)};`,
  );
} else {
  d1(
    `INSERT INTO invitations
        (id, recipient_name, recipient_slug, token_hash, proposal_id, status, expires_at)
      VALUES
        (${q(id)}, ${q(recipient)}, ${q(slug)}, ${q(tokenHash)}, ${q(proposalId)}, 'invited', ${expiresSql});`,
  );
}

const link = `${baseUrl || '<https://your-domain>'}/invitation/#${token}`;
console.log('\n────────────────────────────────────────────────────────────');
console.log(`  Invitation ${existing.length && force ? 're-issued' : 'created'} for ${recipient} (slug: ${slug})`);
console.log(`  Scope: ${remote ? 'REMOTE (production D1)' : 'local D1 shadow'}`);
console.log('  Only the token HASH was stored. The private link below is shown');
console.log('  ONCE and is not saved anywhere — copy it now:');
console.log('\n  ' + link + '\n');
console.log('────────────────────────────────────────────────────────────\n');
