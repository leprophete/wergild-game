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
