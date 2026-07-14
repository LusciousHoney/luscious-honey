/* =============================================================================
   HEADQUARTERS — Executive Office scene asset pipeline.

   Regenerates the optimized, responsive derivatives of the approved Executive
   Office render into public/headquarters/scene/ (AVIF → WebP → JPEG), plus a
   dedicated mobile portrait crop. The master PNG is preserved outside the
   production bundle in art-masters/ (gitignored). Re-run:

     node scripts/build-scene-assets.mjs "/path/to/LHC Office 2.png"

   Requires `sharp` (a devDependency). Not part of the app runtime.
   ============================================================================= */
import sharp from 'sharp';
import { mkdirSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// The source render must be supplied explicitly — no baked-in path. Missing
// argument → concise usage + non-zero exit, before any work is attempted.
const srcArg = process.argv[2];
if (!srcArg) {
  console.error('Usage: node scripts/build-scene-assets.mjs <source-image>');
  console.error('  <source-image>  path to the Executive Office master render (e.g. a PNG).');
  process.exit(1);
}

// Resolve relative to the current working directory, then confirm it exists.
const SRC = resolve(srcArg);
if (!existsSync(SRC)) {
  console.error('Source not found:', SRC);
  process.exit(1);
}

const OUT = resolve('public/headquarters/scene');
const MASTER = resolve('art-masters');
mkdirSync(OUT, { recursive: true });
mkdirSync(MASTER, { recursive: true });

// Preserve the master OUTSIDE the production bundle (art-masters is gitignored,
// not a Vite input, not under public/) for provenance.
copyFileSync(SRC, resolve(MASTER, 'executive-office.png'));

const kb = (p) => (statSync(p).size / 1024).toFixed(1) + ' KB';
const rows = [];

async function emit(name, pipeline) {
  const base = pipeline();
  for (const [ext, img] of [
    ['avif', base.clone().avif({ quality: 52, effort: 5 })],
    ['webp', base.clone().webp({ quality: 76 })],
    ['jpg',  base.clone().jpeg({ quality: 80, mozjpeg: true, progressive: true })],
  ]) {
    const file = resolve(OUT, `${name}.${ext}`);
    const info = await img.toFile(file);
    rows.push({ file: `${name}.${ext}`, w: info.width, h: info.height, size: kb(file) });
  }
}

// Landscape (desktop + tablet): full 5:4 frame, width-responsive.
await emit('exec-1400', () => sharp(SRC).resize({ width: 1400 }));
await emit('exec-1024', () => sharp(SRC).resize({ width: 1024 }));
// Mobile portrait: 3:4 crop centred on desk + coastal view (biased left so the
// window stays; trims the far-right wall and bottom-right table).
await emit('exec-mobile', () =>
  sharp(SRC).extract({ left: 180, top: 0, width: 842, height: 1122 }).resize({ width: 880 }));

console.log('master preserved →', resolve(MASTER, 'executive-office.png'), kb(resolve(MASTER, 'executive-office.png')));
console.table(rows);
