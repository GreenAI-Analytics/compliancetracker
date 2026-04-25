-- V1 product tables extending the base compliance schema

create table if not exists onboarding_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  company_name text not null,
  business_address text,
  incorporation_date date,
  employee_count int,
  country varchar(2) not null,
  nace varchar(10) not null,
  operating_countries text[] not null default '{}',
  modules_selected text[] not null default '{}',
  onboarding_completed boolean not null default false,
  task_reminders_enabled boolean not null default true,
  task_reminder_days_before int not null default 7,
  signup_date timestamp not null default now(),
  trial_ends_at timestamp not null default (now() + interval '30 days'),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique (user_id)
);

create table if not exists custom_categories (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null references users(id) on delete cascade,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists custom_tasks (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references custom_categories(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  details text,
  due_date date,
  status varchar(50) not null default 'pending',
  created_by uuid not null references users(id) on delete cascade,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists hidden_items (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  hidden_by uuid not null references users(id) on delete cascade,
  item_type varchar(30) not null,
  item_ref text not null,
  reason text,
  created_at timestamp not null default now(),
  unique (organization_id, item_type, item_ref)
);

-- Global admin settings (key/value store)
create table if not exists admin_settings (
  key text primary key,
  value text not null,
  updated_at timestamp not null default now()
);

create table if not exists admin_login_rate_limits (
  key text primary key,
  attempts int not null default 0,
  window_started_at timestamp not null default now(),
  blocked_until timestamp,
  updated_at timestamp not null default now()
);

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

-- Seed default billing price
insert into admin_settings (key, value)
values ('billing_monthly_price_eur', '9.99')
on conflict (key) do nothing;

-- Seed default billing visibility (false = show billing to users)
insert into admin_settings (key, value)
values ('billing_hidden', 'false')
on conflict (key) do nothing;

-- Sponsored organisations (not billed)
alter table if exists organizations
  add column if not exists is_sponsored boolean not null default false;

alter table if exists organizations
  add column if not exists sponsored_reason text;

alter table if exists organizations
  add column if not exists billing_contact_name text;

alter table if exists organizations
  add column if not exists billing_email text;

alter table if exists organizations
  add column if not exists billing_address text;

alter table if exists organizations
  add column if not exists vat_number text;

alter table if exists organizations
  add column if not exists purchase_order_ref text;

alter table if exists organizations
  add column if not exists payment_method text;

alter table if exists organizations
  add column if not exists stripe_customer_id text;

alter table if exists organizations
  add column if not exists stripe_subscription_id text;

alter table if exists organizations
  add column if not exists stripe_subscription_status text;

alter table if exists organizations
  add column if not exists stripe_current_period_end timestamp;

create index if not exists idx_onboarding_profiles_org on onboarding_profiles(organization_id);
create index if not exists idx_custom_categories_org on custom_categories(organization_id);
create index if not exists idx_custom_tasks_org on custom_tasks(organization_id);
create index if not exists idx_hidden_items_org on hidden_items(organization_id);
create index if not exists idx_admin_login_rate_limits_blocked_until on admin_login_rate_limits(blocked_until);
create unique index if not exists idx_organizations_stripe_customer_id
  on organizations(stripe_customer_id)
  where stripe_customer_id is not null;
create index if not exists idx_organizations_stripe_subscription_id
  on organizations(stripe_subscription_id)
  where stripe_subscription_id is not null;
create index if not exists idx_task_reminder_deliveries_user on task_reminder_deliveries(user_id);
create index if not exists idx_task_reminder_deliveries_due_date on task_reminder_deliveries(due_date);
create index if not exists idx_task_reminder_deliveries_sent_at on task_reminder_deliveries(sent_at);

alter table if exists onboarding_profiles
  add column if not exists incorporation_date date;

alter table if exists onboarding_profiles
  add column if not exists signup_date timestamp;

alter table if exists onboarding_profiles
  add column if not exists trial_ends_at timestamp;

alter table if exists onboarding_profiles
  add column if not exists task_reminders_enabled boolean;

alter table if exists onboarding_profiles
  add column if not exists task_reminder_days_before int;

update onboarding_profiles
set signup_date = coalesce(signup_date, created_at, now())
where signup_date is null;

update onboarding_profiles
set trial_ends_at = coalesce(trial_ends_at, signup_date + interval '30 days')
where trial_ends_at is null;

update onboarding_profiles
set task_reminders_enabled = coalesce(task_reminders_enabled, true)
where task_reminders_enabled is null;

update onboarding_profiles
set task_reminder_days_before = coalesce(task_reminder_days_before, 7)
where task_reminder_days_before is null;
