-- Schedules the balance reconciliation every 10 minutes (RECONCILE_MINUTES).
-- Run ONCE the site is online (step 9), after replacing the two placeholders.
-- The secret is stored in Supabase Vault, never in the cron job text.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<CRON_SECRET from Vercel>', 'wergild_cron_secret');

select cron.schedule(
  'wergild-reconcile',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<your-domain>/api/cron/reconcile',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'wergild_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
