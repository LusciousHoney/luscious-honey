# Audio Studio — Verification Report (Obj 4)

Verification only. **No rebuild, no redesign.** The Studio is treated as a
permanent Headquarters room.

| Check | Result | Evidence |
| --- | --- | --- |
| **Repository relocation** | ✅ Present in LHC | `private-voice-notes-studio/` — `index.html`, `styles.css`, `script.js`, `serve.mjs`, `README.md`, `audio/.gitkeep`, `images/.gitkeep`. Copied verbatim from PMU (`diff -rq` was identical); no code changes. |
| **Routing** | ✅ Self-contained | `serve.mjs` serves its own folder over `http://`; `/` → `index.html`; MIME map includes audio/video types. Not part of the Vite hash router (external room by design). |
| **Launch path** | ✅ Works | `npm run studio` → `node private-voice-notes-studio/serve.mjs` (port 8080, `PORT=` override). Boot-tested in LHC: HTTP 200, title "Private Voice Notes Studio — Creator Dashboard", `script.js` served. |
| **Dashboard integration** | ✅ Wired | Founder Dashboard (Editorial Office home) shows the Studio card (`.office-studio` in `views.ts` + `office.css`) with launch instructions and `localhost:8080` link. |
| **Permissions architecture** | ✅ Sound | Server refuses path traversal (`filePath.startsWith(ROOT + '/')`, serve.mjs:61) — cannot serve outside its folder. App-level Owner/Contributor roles preserved (private artist sessions). Bound to localhost. |
| **Future-nav compatibility** | ✅ Compatible | Registers cleanly as an **external room** in the planned room registry (`kind:'external'`, `launch:{script,url}`) — see [Architecture.md](Architecture.md). No conflict with internal hash routes. |
| **Private / not deployed** | ✅ Confirmed | Not a Vite input, not under `public/` → absent from `dist`. Live site returns the public homepage (fallback) for `/private-voice-notes-studio/`, never the tool. `.gitignore` ignores its recordings/media. |

## Preserved functionality (unchanged)

Recording workflow (MediaRecorder), private artist sessions (Owner/Contributor),
JSON session save/load/duplicate, per-note audio, WebM export, preview controls.

## Dependencies referencing Pull Me Under

**None in the relocated code** — fully self-contained (only external reference is
Google Fonts). PMU's original copy is intentionally left intact (separate repo).

## Notes / future

- Today the Studio runs on a separate port from the Vite dev server. If a unified
  Headquarters origin is later wanted, the registry's launch card is the seam; no
  rewrite needed.
- Before Headquarters is ever hosted, put **Cloudflare Access** in front of the
  private surface; the Studio remains local-only until then.
