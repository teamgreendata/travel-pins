@AGENTS.md

# Travel Pins

Map-based web app — Next.js + Supabase + MapLibre GL.

<!-- BEGIN:baseline-conventions (synced by scripts/sync-baseline.py — edit blocks there, then re-run) -->
## Baseline conventions

- **Always recommend when asking.** With `AskUserQuestion` or options in prose, name the option you'd pick, whether the lean is **strong** or **weak**, and a one-line why — no neutral menus.
- **Build in milestones and pause** so the user can run each slice before you go deeper; don't start a major new phase without a go-ahead.
- **Keep this file current** — folding session gotchas, non-obvious behavior, and decisions back into `CLAUDE.md` is a pre-commit step, not an afterthought.
- **Verify behavior, not just types** — run `npm run build` + `npm run lint` before committing UI changes and actually exercise user-facing changes (local or live) before claiming they work. Small, reviewable commits; run tests on every change.
- **Stack:** recent Next.js ≠ training data — read `node_modules/next/dist/docs/` before routing/data-fetching; middleware is `proxy.ts`, and `await` `params`/`searchParams`. Supabase via `@supabase/ssr` with `getUser()` (never `getSession()`). Publishable/anon key only in client code — never the service-role key (RLS enforces access). DB scripts use psycopg + `DATABASE_URL`. Never commit secrets or `.env`.
- Keep answers concise and direct.
<!-- END:baseline-conventions -->
