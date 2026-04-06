alter table if exists organizations
  add column if not exists stripe_customer_id text;

alter table if exists organizations
  add column if not exists stripe_subscription_id text;

alter table if exists organizations
  add column if not exists stripe_subscription_status text;

alter table if exists organizations
  add column if not exists stripe_current_period_end timestamp;

create unique index if not exists idx_organizations_stripe_customer_id
  on organizations(stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists idx_organizations_stripe_subscription_id
  on organizations(stripe_subscription_id)
  where stripe_subscription_id is not null;