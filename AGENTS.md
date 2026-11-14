<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Business rules live as pure functions in `src/lib/core/*` with tests in `src/test/core.test.ts`; UI only calls them. Why: planner/SRS/metrics must stay deterministic and verifiable.
- All data access goes through the `Repo` contract (`src/lib/repo`): Cloud for real users, memory for `/demo/*`. Why: demo data must never touch the real database.
- The planner is a deterministic algorithm and must be labelled as such in UI; never present it as AI.
- AI calls only in `src/lib/ai/*.server.ts` via `/api/assistant`, which verifies the bearer token; when unconfigured, show a notice — never fabricate answers.
- Study sessions are recorded with a client-generated `client_id` and upsert on `(user_id, client_id)`. Why: idempotent registration.
