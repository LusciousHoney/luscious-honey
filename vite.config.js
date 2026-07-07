import { defineConfig } from 'vite'
import { resolve } from 'path'

// Multi-page Headquarters. Each canonical destination is a real, semantic
// HTML entry point so the spatial metaphor always has a plain document beneath
// it (Sprint 04 · Part IX, Accessibility). Add wings here as they are built —
// never as empty routes ahead of real content.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        reception: resolve(__dirname, 'index.html'),      // /        Reception (arrival + spine)
        publishing: resolve(__dirname, 'publishing.html'), // /publishing  Editorial wing
        reader: resolve(__dirname, 'reader.html'),         // /publishing/:work  the Reader
        press: resolve(__dirname, 'press.html'),           // /press      House Journal archive
      },
    },
  },
})
