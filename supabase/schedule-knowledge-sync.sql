create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'sync-compliance-knowledge-nightly'
  ) then
    perform cron.unschedule('sync-compliance-knowledge-nightly');
  end if;
end
$$;

-- This schedule reuses vault secrets created by schedule-sync.sql:
--   sync_project_url, sync_anon_key
select cron.schedule(
  'sync-compliance-knowledge-nightly',
  '40 0 * * *',
  $$
  select
    net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'sync_project_url'
      ) || '/functions/v1/sync-compliance-knowledge',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'sync_anon_key'
        ),
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'sync_anon_key'
        )
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

select jobid, jobname, schedule
from cron.job
where jobname = 'sync-compliance-knowledge-nightly';