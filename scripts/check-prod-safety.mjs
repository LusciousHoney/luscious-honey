/* =============================================================================
   PRODUCTION FIXTURE-SAFETY CHECK
   Proves a production build does not expose development/fixture labels.
   Run after `npm run build`:  node scripts/check-prod-safety.mjs
   Exits non-zero (fails CI) if any leak is found.
   ============================================================================= */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = 'dist';

if (!existsSync(DIST)) {
  console.error(`✗ ${DIST}/ not found — run \`npm run build\` first.`);
  process.exit(1);
}

// Collect every built file.
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(DIST);

const htmlFiles = files.filter((f) => extname(f) === '.html');
// HTML + JS are the surfaces that could render a visible label. CSS legitimately
// defines the `.fixture-flag` rule (hidden by default) and is not a leak.
const shippedCode = files.filter((f) => ['.html', '.js'].includes(extname(f)));

const problems = [];

// 1) The build-time env switch must have flipped every page to production.
for (const f of htmlFiles) {
  const s = readFileSync(f, 'utf8');
  if (/data-env="development"/.test(s)) problems.push(`${f}: still ships data-env="development"`);
  if (!/data-env="production"/.test(s)) problems.push(`${f}: missing data-env="production"`);
}

// 2) No fixture markup or visible fixture label text may reach shipped HTML/JS.
const FORBIDDEN = ['fixture-flag', 'Temporary editorial fixture', '>Fixture<'];
for (const f of shippedCode) {
  const s = readFileSync(f, 'utf8');
  for (const needle of FORBIDDEN) {
    if (s.includes(needle)) problems.push(`${f}: contains forbidden fixture marker "${needle}"`);
  }
}

if (problems.length) {
  console.error('✗ Production fixture-safety check FAILED:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `✓ Production fixture-safety check passed ` +
  `(${htmlFiles.length} pages: data-env=production; no fixture markup in shipped HTML/JS).`,
);
