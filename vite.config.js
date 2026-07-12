import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

/**
 * Clean URL for the TK Tribute.
 * The Tribute is authored once as `tk-tribute.html`. After the build, we also
 * emit it as `dist/tribute/tk/index.html` so `/tribute/tk` is served as a real
 * static page — no `_redirects` rewrite, no dependence on proxy/rewrite quirks,
 * no redirect loop. Runs after the bundle (and public/ copy) are written.
 */
function tributeCleanUrl() {
  return {
    name: 'tribute-clean-url',
    apply: 'build',
    closeBundle() {
      const src = resolve(__dirname, 'dist/tk-tribute.html')
      const dest = resolve(__dirname, 'dist/tribute/tk/index.html')
      mkdirSync(dirname(dest), { recursive: true })
      copyFileSync(src, dest)
    },
  }
}

/**
 * Build-time environment attribute.
 * The pages ship `data-env="development"` as authored, but this plugin rewrites
 * it to the real command so we NEVER rely on the static value in production:
 *   `vite` (serve)  → data-env="development"  (fixture labels visible)
 *   `vite build`    → data-env="production"   (fixture labels gated off)
 */
function htmlDataEnv() {
  let isBuild = false
  return {
    name: 'html-data-env',
    config(_config, { command }) { isBuild = command === 'build' },
    transformIndexHtml(html) {
      return html.replace(/(\sdata-env=)"[^"]*"/i, `$1"${isBuild ? 'production' : 'development'}"`)
    },
  }
}

// Multi-page Headquarters. Each canonical destination is a real, semantic
// HTML entry point so the spatial metaphor always has a plain document beneath
// it (Sprint 04 · Part IX, Accessibility). Add wings here as they are built —
// never as empty routes ahead of real content.
export default defineConfig({
  plugins: [htmlDataEnv(), tributeCleanUrl()],
  // Dev server only (never affects `vite build`): proxy API calls to a locally
  // running `wrangler pages dev` so Functions + D1 can be exercised while the
  // page is served by Vite. Cloudflare Pages ignores this block entirely.
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
  build: {
    rollupOptions: {
      input: {
        reception: resolve(__dirname, 'index.html'),      // /        Reception (arrival + spine)
        publishing: resolve(__dirname, 'publishing.html'), // /publishing  Editorial wing
        reader: resolve(__dirname, 'reader.html'),         // /publishing/:work  the Reader
        press: resolve(__dirname, 'press.html'),           // /press      House Journal archive
        artistFeatures: resolve(__dirname, 'artist-features.html'), // /artist-features  Artist Features intake
        tribute: resolve(__dirname, 'tk-tribute.html'),    // /tk-tribute Permanent Collection · Tribute No. 01
        // Private making tools. Gated by Cloudflare Access on /production-studio*
        // (see docs/DEPLOY.md). Emitted as production-studio/index.html so the
        // hub IS the directory index — avoids a file-vs-directory trailing-slash
        // collision with the Voice Notes app shipped verbatim from
        // public/production-studio/voice-notes/.
        productionStudio: resolve(__dirname, 'production-studio/index.html'), // /production-studio/  Studio hub (private)
        editorialOffice: resolve(__dirname, 'editorial-office/index.html'), // /editorial-office/  Editorial Office · Submission Review (private, Access-gated)
      },
    },
  },
})
