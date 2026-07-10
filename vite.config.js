import { defineConfig } from 'vite'
import { resolve } from 'path'

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
  plugins: [htmlDataEnv()],
  build: {
    rollupOptions: {
      input: {
        reception: resolve(__dirname, 'index.html'),      // /        Reception (arrival + spine)
        publishing: resolve(__dirname, 'publishing.html'), // /publishing  Editorial wing
        reader: resolve(__dirname, 'reader.html'),         // /publishing/:work  the Reader
        press: resolve(__dirname, 'press.html'),           // /press      House Journal archive
        tribute: resolve(__dirname, 'tk-tribute.html'),    // /tk-tribute Permanent Collection · Tribute No. 01
      },
    },
  },
})
