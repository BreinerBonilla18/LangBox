# AGENTS.md

LangBox: offline-first Vue 3 + Vite PWA. Single package, no monorepo, no CI, no tests.

## Commands

- `npm run lint` — the only static check (no typecheck, no test suite exists)
- `npm run build` — catches Vue template/compile errors; verify with `npm run lint && npm run build`
- `npm run dev` — dev server; **the service worker is disabled in dev** (`devOptions.enabled: false`)
- `npm run build && npm run preview` — the ONLY way to test offline mode, SW updates, or the install prompt
- `npm run pwa:assets` — run after editing `public/langbox.svg`; regenerates `public/pwa-*.png`,
  favicons, and flattens icons onto the brand color. Never hand-edit generated icons.

## Setup

- `.env` (gitignored; no `.env.example`): `VITE_GEMINI_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Node `^20.19.0 || >=22.12.0` (Vite 8 requirement)
- No migration tooling: the `public.words` table + RLS policies are applied by hand from the SQL in README.md.

## Offline-first invariants (don't break these)

- The app must mount without network (`src/main.js`): auth/sync resolve in background and may fail.
  Never gate `app.mount()` or local reads on Supabase.
- `navigator.onLine` is not trusted: `src/stores/networkStore.js` probes the Supabase health endpoint
  every 30s and treats any HTTP response as online. Don't "simplify" this to `navigator.onLine`.
- Supabase/Gemini `fetch` calls must stay out of the service worker cache (see `vite.config.js` comments);
  connectivity is decided by `networkStore` + the `pendingOps` queue in `syncService.js`.
- Dexie schema: only ever add a new `db.version(n).stores({...})` — never edit existing versions.
  `pendingOps` primary key is `[word_id+type]` (dedupe by design); each op is stamped with its
  owner `user_id` and `flushPendingOps` only uploads ops of the active account.
- The queue drains via `startFlushScheduler` (`main.js`: backoff + `online`/`visibilitychange`),
  not only the `networkStore` reconnect edge — iOS PWAs never fire the `offline` event, so that
  edge can be missing. Never drop an op for "no session": `getSession()` is null when the access
  token expired offline; the owner fallback lives in `getStoredUserId()` (`supabaseClient.js`).
- SRS state (`r`, `ef`, `i`, `nrd`) is written through the single path in `src/core/api/syncService.js`;
  writing it elsewhere can overwrite a newer cloud review schedule.
- `vercel.json` must keep no-cache headers on `/sw.js`, `/manifest.webmanifest`, `/index.html`.

## Conventions

- Comments, UI strings, and commit messages are written in Spanish — match the surrounding file.
- README.md is the primary doc and is kept in sync with behavior; its file tree lags new files.
  Trust the code over the tree.
- `dist/` is lint-ignored build output; ESLint config lives in `eslint.config.js` (flat config).
