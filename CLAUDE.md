@AGENTS.md

# Travel Pins

Map-based web app — Next.js 16 + React 19 + Supabase (`@supabase/ssr`) + MapLibre GL + Tailwind v4.
Start with `travel-map-app-handoff.md` (the build spec) and `docs/` before writing code; auth
gate is `proxy.ts` (Next 16 middleware rename), Supabase config in `supabase/`.

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # eslint
```

> This brief is thin — as systems ship, fold decisions and gotchas back here per the baseline
> conventions below.

<!-- BEGIN:baseline-conventions (synced by scripts/sync-baseline.py — edit blocks there, then re-run) -->
## Baseline conventions

- **Always recommend when asking.** With `AskUserQuestion` or options in prose, name the option you'd pick, whether the lean is **strong** or **weak**, and a one-line why — no neutral menus.
- **Build in milestones and pause** so the user can run each slice before you go deeper; don't start a major new phase without a go-ahead.
- **Keep this file current** — folding session gotchas, non-obvious behavior, and decisions back into `CLAUDE.md` is a pre-commit step, not an afterthought.
- **Hand owner-only tasks to the dashboard.** Anything Rob must do himself (buy, deploy on another host, set an env var, click in a vendor UI) goes as a `- [ ] **Short title** — detail` line under `## Owner actions` in the project's `BACKLOG.md` (create the file/section if missing; keep titles unique — the title is the sync key). The Green Phoenix sync tags these `owner` and shows them at `/assigned-tasks` + the "Assigned to me" tile; a box ticked there is written back to this file, so read the file, don't assume.
- **Verify behavior, not just types** — run `npm run build` + `npm run lint` before committing UI changes and actually exercise user-facing changes (local or live) before claiming they work. Small, reviewable commits; run tests on every change.
- **Stack:** recent Next.js ≠ training data — read `node_modules/next/dist/docs/` before routing/data-fetching; middleware is `proxy.ts`, and `await` `params`/`searchParams`. Supabase via `@supabase/ssr` with `getUser()` (never `getSession()`). Publishable/anon key only in client code — never the service-role key (RLS enforces access). DB scripts use psycopg + `DATABASE_URL`. Never commit secrets or `.env`.
- **Public sign-up needs a CAPTCHA that Supabase Auth enforces** (Cloudflare Turnstile; token passed as `captchaToken` on every sign-up, password sign-in and password reset; pattern in Forever Young `src/components/TurnstileWidget.tsx`). The publishable key lets a bot post to `/auth/v1/signup` without the form, so a form-only check does not count. No public sign-up → close sign-up in the Supabase dashboard.
- Keep answers concise and direct.
<!-- END:baseline-conventions -->
