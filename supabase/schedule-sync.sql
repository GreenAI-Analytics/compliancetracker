create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists vault;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'sync-compliance-rules-nightly'
  ) then
    perform cron.unschedule('sync-compliance-rules-nightly');
  end if;
end
$$;

-- Store the project URL and anon key once in Vault.
-- Replace ANON_KEY_HERE before running this script.
select vault.create_secret(
  'https://mqlwmewhkxgystwktcbc.supabase.co',
  'sync_project_url',
  'Compliance Tracker project URL for scheduled function invocation'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'sync_project_url'
);

select vault.create_secret(
  'ANON_KEY_HERE',
  'sync_anon_key',
  'Compliance Tracker anon key for scheduled function invocation'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'sync_anon_key'
);

select cron.schedule(
  'sync-compliance-rules-nightly',
  '30 0 * * *',
  $$
  select
    net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'sync_project_url'
      ) || '/functions/v1/sync-compliance-rules',
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
where jobname = 'sync-compliance-rules-nightly';