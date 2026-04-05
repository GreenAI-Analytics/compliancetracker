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
