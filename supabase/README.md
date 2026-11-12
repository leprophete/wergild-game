# Database (Supabase)

Project: `wergild-game` (`iqpntnhbouevfstanpbn`, eu-west-3 Paris).

## Files

| File | What it does |
| --- | --- |
| `migrations/…_schema.sql` | The 10 tables, the `cell_strength` view, `map_strengths()` |
| `migrations/…_rls_and_realtime.sql` | RLS on every table, public read on map + rankings only, no browser writes, Realtime publication |
| `migrations/…_fk_indexes.sql` | Foreign-key indexes (performance advisor) |
| `seed.sql` | 5 Banners, Season 0 "The Proving Grounds", 1 440 cells (generated) |
| `seed_demo.sql` | Optional fake armies, one `DEMO…` wallet per Banner (generated) |

Both seeds are generated from `src/lib/map/layout.ts` — the same geography the map draws:

```bash
npm run seed:gen            # → supabase/seed.sql
npm run seed:gen -- demo    # → supabase/seed_demo.sql
```

## Security model

- The browser uses the **publishable key** only. RLS lets it read `factions`, `seasons`, `cells`,
  `events`, `score_ticks`, `player_scores`, and the aggregated `map_strengths()` — nothing else.
- `players`, `deployments`, `balance_history`, `auth_nonces` and the `cell_strength` view are not readable from outside.
- No INSERT / UPDATE / DELETE privilege for `anon` / `authenticated` on any table.
  Every write goes through the server API with the **secret key** (from step 3).
- No `is_admin` column: the admin wallet is a server environment variable.

## Removing the demo armies

```sql
delete from public.players where wallet like 'DEMO%';
update public.cells set owner_faction_id = base_faction_id, contested = false;
```

## On-chain balances (step 4)

- `apply_balance()` turns a balance **read by RPC** into soldiers, seniority and force (rules 1, 2, 6, 10).
  Test: [`tests/balance_rules.sql`](tests/balance_rules.sql) — runs in a block that rolls back.
- Balances are refreshed by: the Helius webhook (`/api/webhooks/helius`), the 10-minute job
  (`/api/cron/reconcile`), and `/api/me` when the last read is older than a minute.
- Devnet test token: `npm run devnet -- create | send <wallet> <amount> | balance <wallet>`.

### At deployment (step 9)

1. **Helius webhook** — dashboard.helius.dev → Webhooks → New: type *Enhanced*, transaction type *Any*,
   network matching the token, account address = the token **mint**, URL
   `https://<your-domain>/api/webhooks/helius`, *Authentication header* = the value of `HELIUS_WEBHOOK_SECRET`.
2. **10-minute job** — fill in and run [`cron_reconcile.sql`](cron_reconcile.sql) in the SQL editor.

## Game actions (step 5)

- `game_action()` — deploy, withdraw, move in **one transaction**, player row locked (no double spend).
  Rules 4 and 5: adjacency, river, impregnable camps, reserve, 20 000 per player per cell, 1 h wet ink
  (lifted during The Rush), owner recomputed with the tie going to the holder.
- Test: [`tests/game_rules.sql`](tests/game_rules.sql) — 18 checks, rolled back.
- API: `POST /api/deploy`, `/api/withdraw`, `/api/move`. Deploy and move re-read the on-chain balance first.

## The map geography (land / water mask)

The playable cells come from `src/lib/map/mask.ts`, built over `public/map/world.png`
(validated 12 Nov 2026): 977 playable cells, 463 sea/river cells, 4 bridges, 8 watchtowers,
base camps on the illustrated landmarks. To change it:

1. edit it visually at `/dev/mask` (dev server only) and paste the result into `mask.ts`;
2. `npm run seed:gen -- remap` → `supabase/apply_world_mask.sql`;
3. run that file in the SQL editor: soldiers that end up on water (or on another Banner's camp)
   go back to reserve, cells and camps are rewritten, every owner is recomputed.
