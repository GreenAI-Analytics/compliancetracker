create table if not exists admin_login_rate_limits (
  key text primary key,
  attempts int not null default 0,
  window_started_at timestamp not null default now(),
  blocked_until timestamp,
  updated_at timestamp not null default now()
);

create index if not exists idx_admin_login_rate_limits_blocked_until
  on admin_login_rate_limits(blocked_until);