## Independent infrastructure

- Use standard Vite/TanStack, a persistent local SQLite backend by default (Supabase Auth/Postgres/Storage is optional), and a server-only configurable AI provider.
- Schema changes live in versioned SQL under `supabase/migrations/`. Do not rewrite applied migration history or reset production data.
- Never commit secrets or put service-role/provider keys in browser code.
- Generated route/type files remain generated; modify their sources or regenerate them.

## Project rules

- Business rules live as pure functions in `src/lib/core/*` with tests in `src/test/core.test.ts`; UI only calls them. Why: planner/SRS/metrics must stay deterministic and verifiable.
- All data access goes through the `Repo` contract (`src/lib/repo`): local SQLite or Cloud for real users, memory for `/demo/*`. Why: demo data must never touch the real database.
- The planner is a deterministic algorithm and must be labelled as such in UI; never present it as AI.
- AI calls only in `src/lib/ai/*.server.ts` via `/api/assistant`, which verifies the bearer token; when unconfigured, show a notice — never fabricate answers.
- Study sessions are recorded with a client-generated `client_id` and upsert on `(user_id, client_id)`. Why: idempotent registration.
