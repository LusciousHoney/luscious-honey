/* =============================================================================
   apply-access-and-deploy.mjs
   -----------------------------------------------------------------------------
   Finishes wiring the private Production Studio, end to end, in one run:

     1. Reads the existing Cloudflare Access application "Production Studio
        (private)" and its Application Audience (AUD) tag.
     2. Reads the Zero Trust organization's team domain (auth_domain).
     3. Reads the existing Pages project config (does NOT write yet).
     4. MERGES ACCESS_TEAM_DOMAIN + ACCESS_AUD into the Production AND Preview
        environment variable maps — sending ONLY those two keys, so Cloudflare
        preserves every existing variable (including secrets it would redact).
     5. Reads the project back and verifies both names exist in both scopes and
        that every previously-present variable is still there.
     6. Runs `npm run verify`, then deploys with Wrangler.
     7. Confirms Pages Functions compiled, then checks live behaviour:
        homepage 200; unauthenticated /production-studio/ redirects to Access
        (or 403) and is NEVER served as a 200.

   SAFETY / PRIVACY
     - Dry-run by default. Prints a redacted plan and STOPS. Pass --apply to write + deploy.
     - Never prints, logs, or saves: the API token, the AUD, or the team domain.
     - Never resends existing variables (so redacted secrets can't be clobbered).
     - Never touches the Access application, its policy, or allowed emails —
       if the app is missing or its path looks wrong, it REPORTS and stops.
     - Stops before writing if the token lacks a required permission.

   REQUIRES (terminal-only env; nothing is persisted):
     CF_API_TOKEN    custom token — see the required scopes printed by --help/dry-run
     CF_ACCOUNT_ID   the account id (in docs/DEPLOY.md)

   USAGE
     CF_API_TOKEN=… CF_ACCOUNT_ID=… node scripts/apply-access-and-deploy.mjs            # dry-run (no changes)
     CF_API_TOKEN=… CF_ACCOUNT_ID=… node scripts/apply-access-and-deploy.mjs --apply     # write env + deploy + verify
   ============================================================================= */

import { spawnSync } from 'node:child_process'

const APPLY = process.argv.includes('--apply')
const API = 'https://api.cloudflare.com/client/v4'

const token = process.env.CF_API_TOKEN
const account = process.env.CF_ACCOUNT_ID

const PROJECT = 'luscious-honey-collective'
const APP_NAME = 'Production Studio (private)'
const DOMAIN_HOST = 'luscioushoneycollective.com'
const APP_PATH = '/production-studio'
const SITE = `https://${DOMAIN_HOST}`
const NEW_KEYS = ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD']

const REQUIRED_SCOPES = [
  'Account · Access: Apps and Policies · Read',
  'Account · Access: Organizations, Identity Providers, and Groups · Read',
  'Account · Cloudflare Pages · Edit',
]

function die(msg, code = 1) { console.error(`\n✗ ${msg}\n`); process.exit(code) }
function ok(msg) { console.log(`  ✓ ${msg}`) }
function warn(msg) { console.warn(`  ⚠ ${msg}`) }

if (!token || !account) {
  die(
    'Missing CF_API_TOKEN and/or CF_ACCOUNT_ID (terminal-only env vars).\n' +
    '  This token needs exactly these scopes, on this account only:\n' +
    REQUIRED_SCOPES.map(s => `    - ${s}`).join('\n'),
  )
}

// ── HTTP helper — never logs the token ──────────────────────────────────────
async function cf(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  let json = null
  try { json = await res.json() } catch { /* non-JSON */ }
  const success = res.ok && json && json.success !== false
  return { success, status: res.status, json }
}
function errText(r) {
  const e = r.json && r.json.errors
  return Array.isArray(e) && e.length ? e.map(x => `${x.code}: ${x.message}`).join('; ') : `HTTP ${r.status}`
}
function isPermError(r) {
  if (r.status === 403 || r.status === 401) return true
  const e = (r.json && r.json.errors) || []
  return e.some(x => [10000, 9109, 9106, 9103, 9007, 9000].includes(x.code))
}
function permDie(r, scope) {
  if (isPermError(r)) die(`Token is missing permission "${scope}". (API said: ${errText(r)})\n  Add that scope to the token and re-run. No changes were made.`)
}

const envNames = o => Object.keys(o || {})
const secretCount = o => Object.values(o || {}).filter(v => v && v.type === 'secret_text').length

// ── 1. Access application + AUD ─────────────────────────────────────────────
console.log(`\nCloudflare Access → Pages env wiring   (${APPLY ? 'APPLY' : 'dry-run'})`)
console.log('────────────────────────────────────────────────────────')

const apps = await cf('GET', `/accounts/${account}/access/apps`)
if (!apps.success) { permDie(apps, REQUIRED_SCOPES[0]); die(`Could not list Access applications: ${errText(apps)}`) }
const app = (apps.json.result || []).find(a => a.name === APP_NAME)
if (!app) die(`Access application "${APP_NAME}" was not found on this account.\n  Create it first (scripts/setup-access.mjs --apply). This script does not create or modify Access.`)
if (!app.aud) die(`Access application "${APP_NAME}" has no AUD tag readable via this token.`)
const aud = app.aud
ok(`Access application found: "${APP_NAME}" (id ${app.id})`)
ok('AUD retrieved (value hidden)')
// Report-only sanity check on coverage; never modify Access.
if (!String(app.domain || '').toLowerCase().includes(APP_PATH)) {
  warn(`this app's domain "${app.domain}" does not appear to cover ${APP_PATH} — review it in the dashboard. (Not modifying Access.)`)
} else {
  ok(`covers path ${APP_PATH}`)
}

// ── 2. Team domain (auth_domain) ────────────────────────────────────────────
const org = await cf('GET', `/accounts/${account}/access/organizations`)
if (!org.success) { permDie(org, REQUIRED_SCOPES[1]); die(`Could not read Zero Trust organization: ${errText(org)}`) }
const teamDomain = org.json.result && org.json.result.auth_domain
if (!teamDomain) die('Could not read the team domain (auth_domain) from the Zero Trust organization.')
ok('Team domain retrieved (value hidden)')

// ── 3. Read Pages project BEFORE writing ────────────────────────────────────
const before = await cf('GET', `/accounts/${account}/pages/projects/${PROJECT}`)
if (!before.success) { permDie(before, REQUIRED_SCOPES[2]); die(`Could not read Pages project "${PROJECT}": ${errText(before)}`) }
const dc = (before.json.result && before.json.result.deployment_configs) || {}
const prodVars = (dc.production && dc.production.env_vars) || {}
const prevVars = (dc.preview && dc.preview.env_vars) || {}

// ── 8. Redacted dry-run summary ─────────────────────────────────────────────
console.log('\nPlan')
console.log(`  Pages project        : ${PROJECT}`)
console.log(`  Variables to add     : ${NEW_KEYS.join(', ')}  (type: plain_text, both scopes)`)
console.log(`  Production preserved (${envNames(prodVars).length}) : ${envNames(prodVars).join(', ') || '(none)'}   [secrets: ${secretCount(prodVars)}]`)
console.log(`  Preview    preserved (${envNames(prevVars).length}) : ${envNames(prevVars).join(', ') || '(none)'}   [secrets: ${secretCount(prevVars)}]`)
for (const scope of [['Production', prodVars], ['Preview', prevVars]]) {
  const already = NEW_KEYS.filter(k => k in scope[1])
  if (already.length) console.log(`  Note: ${scope[0]} already has ${already.join(', ')} — will be updated in place (merge preserves the rest).`)
}
console.log('  Secret values        : never printed. AUD / team domain: never printed.')

if (!APPLY) {
  console.log('\nDry-run only — no changes made. Re-run with --apply to write env vars and deploy.\n')
  process.exit(0)
}

// ── 4. Narrow merge write (send ONLY the two new keys, both scopes) ──────────
console.log('\nApplying (narrow merge — existing variables are not resent)…')
const newEnv = {
  ACCESS_TEAM_DOMAIN: { type: 'plain_text', value: teamDomain },
  ACCESS_AUD: { type: 'plain_text', value: aud },
}
const patch = {
  deployment_configs: {
    production: { env_vars: newEnv },
    preview: { env_vars: newEnv },
  },
}
const wrote = await cf('PATCH', `/accounts/${account}/pages/projects/${PROJECT}`, patch)
if (!wrote.success) { permDie(wrote, REQUIRED_SCOPES[2]); die(`PATCH failed: ${errText(wrote)}`) }
ok('PATCH accepted')

// ── 5 / 10. Read back and verify (names only) ───────────────────────────────
const after = await cf('GET', `/accounts/${account}/pages/projects/${PROJECT}`)
if (!after.success) die(`Could not re-read Pages project for verification: ${errText(after)}`)
const adc = (after.json.result && after.json.result.deployment_configs) || {}
const aProd = (adc.production && adc.production.env_vars) || {}
const aPrev = (adc.preview && adc.preview.env_vars) || {}

const problems = []
for (const [scope, beforeVars, afterVars] of [['Production', prodVars, aProd], ['Preview', prevVars, aPrev]]) {
  for (const k of NEW_KEYS) if (!(k in afterVars)) problems.push(`${scope}: ${k} missing after write`)
  for (const k of envNames(beforeVars)) if (!(k in afterVars)) problems.push(`${scope}: previously-present "${k}" was DROPPED`)
}
if (problems.length) die(`Verification FAILED — env vars not safely merged:\n${problems.map(p => '    - ' + p).join('\n')}\n  Review the project in the dashboard before deploying.`)
ok(`Verified: ${NEW_KEYS.join(' + ')} present in Production and Preview`)
ok(`Verified: all previously-present variables preserved (prod ${envNames(prodVars).length}, preview ${envNames(prevVars).length})`)

// ── 11. Verify + deploy ─────────────────────────────────────────────────────
function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { stdio: ['inherit', 'pipe', 'pipe'], encoding: 'utf8', ...opts })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  return r
}

const v = run('npm', ['run', 'verify'])
if (v.status !== 0) die('`npm run verify` failed — not deploying.')
ok('verify passed')

// Deploy. Wrangler authenticates from CLOUDFLARE_API_TOKEN / _ACCOUNT_ID (not printed).
const dep = run('npx', ['wrangler', 'pages', 'deploy'], {
  env: { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account },
})
if (dep.status !== 0) die('`wrangler pages deploy` failed.')
const depOut = `${dep.stdout || ''}\n${dep.stderr || ''}`

// ── 12. Confirm Functions compiled ──────────────────────────────────────────
const fnCompiled = /(Compiled Worker|Uploading Functions|Found \d+ function|Functions bundle|_middleware|_worker)/i.test(depOut)
if (fnCompiled) ok('Pages Functions compiled (middleware bundled into the deploy)')
else warn('Could not confirm Functions compiled from deploy output — check the deploy log / Functions tab. If they did not compile, /production-studio* would 404 instead of 403.')

// ── 13. Live verification (public, unauthenticated) ─────────────────────────
async function probe(path) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(`${SITE}${path}`, { redirect: 'manual', headers: { 'cache-control': 'no-cache' } })
      return res
    } catch {
      await new Promise(r => setTimeout(r, 4000)) // propagation grace
    }
  }
  return null
}

console.log('\nLive verification (unauthenticated)')
const home = await probe('/')
if (!home) warn('homepage did not respond yet (propagation?) — re-check manually')
else if (home.status === 200) ok('homepage returns 200 (public site available)')
else warn(`homepage returned ${home.status} (expected 200) — re-check manually`)

let studioSafe = false
const prot = await probe('/production-studio/')
if (!prot) {
  warn('/production-studio/ did not respond yet — re-check shortly')
} else {
  const loc = prot.headers.get('location') || ''
  const toAccess = /cloudflareaccess\.com|\/cdn-cgi\/access/i.test(loc)
  if ((prot.status === 301 || prot.status === 302 || prot.status === 303 || prot.status === 307 || prot.status === 308) && toAccess) {
    ok(`/production-studio/ → ${prot.status} redirect to Cloudflare Access login (gated)`); studioSafe = true
  } else if (prot.status === 403) {
    ok('/production-studio/ → 403 (middleware fail-closed; gated)'); studioSafe = true
  } else if (prot.status === 200) {
    die('DANGER: /production-studio/ returned 200 WITHOUT authentication — the Studio is publicly exposed. Investigate the Access application and env vars immediately.')
  } else {
    warn(`/production-studio/ returned ${prot.status} (location: ${loc || 'none'}) — not a 200, but confirm it routes to Access.`)
  }
}

console.log('\n────────────────────────────────────────────────────────')
console.log(studioSafe
  ? '✓ Done. Env vars merged, deployed, Studio gated (not publicly served).'
  : '△ Done applying, but live gating was not positively confirmed — verify /production-studio/ manually before sharing.')
console.log('')
