/* ==========================================================================
   Private Voice Notes Studio — local launcher
   A tiny static file server with ZERO dependencies (Node built-ins only).
   It serves the Studio folder over http:// (required — the app uses ES module
   scripts, which browsers refuse to load from a file:// path) and opens your
   browser automatically.

   This launcher lives in scripts/ (NOT in public/) so it is never emitted to
   dist/ or deployed. It serves the app assets from public/production-studio/
   voice-notes/.

   Run it with:
     npm run studio                 (from the repository root)

   Stop it with Control-C. Change the port with:  PORT=9000 npm run studio
   ========================================================================== */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// The script sits in scripts/; the app assets live in public/production-studio/
// voice-notes/. Resolve that folder relative to this file so `npm run studio`
// works from any CWD.
const ROOT = normalize(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'production-studio', 'voice-notes'),
);
const START_PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    // Resolve inside ROOT and refuse anything that escapes it (path traversal).
    const filePath = normalize(join(ROOT, urlPath));
    if (filePath !== ROOT && !filePath.startsWith(ROOT + '/')) {
      return send(res, 403, 'Forbidden');
    }

    let info;
    try {
      info = await stat(filePath);
    } catch {
      return send(res, 404, 'Not found');
    }
    if (info.isDirectory()) return send(res, 404, 'Not found');

    const data = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    send(res, 200, data, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  } catch {
    send(res, 500, 'Server error');
  }
});

function openBrowser(url) {
  if (process.env.NO_OPEN) return;
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* opening the browser is a convenience; ignore if it fails */
  }
}

// Try the chosen port; if it's busy, step up to the next few automatically.
function listen(port, attemptsLeft) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
    } else {
      console.error(`\n  Could not start the studio: ${err.message}\n`);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    const url = `http://localhost:${port}/`;
    console.log('\n  🎙  Private Voice Notes Studio is running');
    console.log('  ---------------------------------------------');
    console.log(`  Open in your browser:  ${url}`);
    console.log('  Stop the studio:       Control-C\n');
    openBrowser(url);
  });
}

listen(START_PORT, 10);
