# Going live (step 9)

## 1. Vercel

1. vercel.com → **Add New… → Project** → import the GitHub repo `wergild-game`. Framework: Next.js (detected), no build setting to change.
2. **Settings → Environment Variables**: add the table below for **Production** (and Preview if you use it).
3. Deploy. Then **Settings → Domains**: add your domain, and put that same domain in `APP_DOMAIN` (redeploy after changing it).

### Environment variables

| Variable | Secret? | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Supabase → Project Settings → API: `https://<project>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no (read-only, RLS) | Supabase → API Keys → publishable key `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | **yes** | Supabase → API Keys → secret key `sb_secret_…`. Server only |
| `APP_DOMAIN` | no | The domain(s) players sign in on, comma-separated, no scheme: `wergild.game,www.wergild.game`. **Required**: without it, sign-in is refused in production |
| `SESSION_SECRET` | **yes** | A NEW random value for production, ≥ 32 chars: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `ADMIN_WALLETS` | no | Wallet(s) allowed on `/admin`, comma-separated |
| `NEXT_PUBLIC_TOKEN_MINT` | no | The token mint (devnet test mint until launch, then the pump.fun mint) |
| `HELIUS_API_KEY` | **yes** | dashboard.helius.dev → API Keys (server-side RPC reads) |
| `SOLANA_RPC_URL` | **yes** (contains a key) | Optional: any RPC URL; overrides the Helius one |
| `NEXT_PUBLIC_SOLANA_RPC` | no (public) | Optional: RPC the wallet adapter uses in the browser. **Never** put a keyed URL here |
| `HELIUS_WEBHOOK_SECRET` | **yes** | A random value ≥ 16 chars, also typed in the Helius webhook |
| `CRON_SECRET` | **yes** | A random value ≥ 16 chars, also stored in Supabase Vault (below) |
| `NEXT_PUBLIC_DEV_WALLET` | no | The developer's wallet, shown on `/rules` (rule 10). Set at launch |

`NEXT_PUBLIC_*` values are visible in the browser by design; everything marked secret must only live in Vercel's settings and in `.env.local` (git-ignored).

## 2. Once the site is online

1. **Reconcile job (every 10 min)**: open `supabase/cron_reconcile.sql`, replace `<CRON_SECRET from Vercel>` and `<your-domain>`, run it once in the Supabase SQL editor.
2. **Helius webhook**: dashboard.helius.dev → Webhooks → New: type *Enhanced*, transaction *Any*, network = the token's, account address = the token **mint**, URL `https://<your-domain>/api/webhooks/helius`, *Authentication header* = `HELIUS_WEBHOOK_SECRET`.
3. **Supabase Auth**: Authentication → Providers / Sign In: turn off *Allow new users to sign up* (the game signs in with Solana, never with Supabase Auth).
4. Sign in on the live site with an `ADMIN_WALLETS` wallet and open `/admin`.

## 3. At launch (token day, see SPEC "Séquence de lancement")

- `config/game.ts`: `SOLANA_CLUSTER = "mainnet-beta"`; `BUY_URL` = the pump.fun page; `FACTION_TELEGRAM_LINKS` once the groups exist.
- Vercel: `NEXT_PUBLIC_TOKEN_MINT` = the pump.fun mint, `NEXT_PUBLIC_DEV_WALLET`, mainnet `HELIUS_API_KEY` / RPC; redeploy.
- `/admin` → Excluded wallets: the bonding curve, the dev wallet, then the DEX pool after migration.
- The Helius webhook: switch it to the mainnet mint.
- Remove the demo players (`DEMO…` wallets) from the database before Season 1.

## Already scheduled in the database (pg_cron)

| Job | When | What |
| --- | --- | --- |
| `wergild-score-tick` | every full hour (UTC) | rule 7 |
| `wergild-season` | every minute | the Plague, the knell, the next season |
| `wergild-housekeeping` | hh:30 | purge rate-limit windows and expired sign-in nonces |
| `wergild-reconcile` | every 10 min | **added by you** after going live (step 2.1) |

## Security review (step 9) — what was checked

Attacked from outside with only the URL and the publishable key (scripts kept out of the repo):

- **Every table**: insert / update / delete refused for `anon` (42501). Private tables (`players`, `deployments`, `balance_history`, `auth_nonces`, `rate_limits`) and the `cell_strength` view are unreadable, also through embedded joins. Public tables expose only map, scores and archives.
- **Every function**: none callable from outside (`map_strengths` included since this step: `/api/map` reads it server-side). New functions and tables are no longer exposed by default (schema default privileges revoked). GraphQL is off.
- **API routes**: no session → 401; forged, tampered, swapped-wallet or expired session cookies → 401; non-admin on `/api/admin/*` → 403; extra `wallet` fields, negative / float / huge / string amounts, out-of-grid cells, invalid JSON, bodies over 4 kB → 400; webhook and cron without the right secret → 401; sign-in nonce under a foreign `Host` → refused; random signature → 401 and the nonce is burnt.

Fixed during the review:

- **Rate limiting** (SPEC: 30 actions per minute per wallet) was missing: now enforced in Postgres (`hit_rate_limit`) for deploy / withdraw / move / join, and per IP for sign-in (20 nonces and 20 verifications per minute). 429 beyond.
- **Cross-site requests**: every state-changing `/api` call coming from another site is refused (middleware on `Origin` / `Sec-Fetch-Site`), on top of the SameSite=Lax cookie.
- **Security headers**: Content-Security-Policy (no framing, scripts and connections limited to the site, Supabase and Solana RPC), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS in production.
- An unknown player acting now gets "Sign in again" (401) instead of a server error; JSON bodies are measured for real, not only by their declared length.

Accepted, by design:

- Supabase advisor "RLS enabled, no policy" on the private tables: no policy = no access from outside, which is the point.
- A session cookie stays valid 7 days and cannot be revoked server-side; logging out deletes it from the browser.
- The ranking shows full wallet addresses of renowned players (public on-chain data).

Tests (all green): `npm test` (zones, Banner page figures) and the four SQL suites in `supabase/tests/` (balances 9, game actions 18, score, seasons 17), each run in a block that rolls back.
