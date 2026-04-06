create extension if not exists pgcrypto;

create table if not exists task_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  task_source text not null check (task_source in ('standard', 'custom')),
  source_id uuid not null,
  organization_id uuid references organizations(id) on delete set null,
  due_date date not null,
  days_before int not null check (days_before in (1, 3, 7, 14, 30)),
  resend_email_id text,
  sent_at timestamp not null default now(),
  created_at timestamp not null default now(),
  unique (user_id, task_source, source_id, days_before, due_date)
);

create index if not exists idx_task_reminder_deliveries_user
  on task_reminder_deliveries(user_id);

create index if not exists idx_task_reminder_deliveries_due_date
  on task_reminder_deliveries(due_date);

create index if not exists idx_task_reminder_deliveries_sent_at
  on task_reminder_deliveries(sent_at);