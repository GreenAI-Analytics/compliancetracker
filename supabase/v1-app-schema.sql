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

create index if not exists idx_onboarding_profiles_org on onboarding_profiles(organization_id);
create index if not exists idx_custom_categories_org on custom_categories(organization_id);
create index if not exists idx_custom_tasks_org on custom_tasks(organization_id);
create index if not exists idx_hidden_items_org on hidden_items(organization_id);

alter table if exists onboarding_profiles
  add column if not exists incorporation_date date;
