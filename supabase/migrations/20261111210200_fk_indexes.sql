-- Covering indexes for foreign keys (Supabase performance advisor).
create index cells_base_faction_idx on public.cells (base_faction_id);
create index cells_owner_faction_idx on public.cells (owner_faction_id);
create index player_scores_wallet_idx on public.player_scores (wallet);
create index score_ticks_faction_idx on public.score_ticks (faction_id);
create index seasons_winner_idx on public.seasons (winner_faction_id);

-- Security advisor flags map_strengths (SECURITY DEFINER callable by anon). This is intended:
-- it only returns per-Banner totals per cell — the public map — never a wallet or a deployment.
comment on function public.map_strengths(bigint) is
  'Public map read: total force per cell and per Banner for a season. Aggregates only, no wallet. SECURITY DEFINER on purpose (deployments/players stay private).';
