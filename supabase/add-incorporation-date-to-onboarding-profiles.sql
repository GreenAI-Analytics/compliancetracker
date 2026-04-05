alter table if exists onboarding_profiles
  add column if not exists incorporation_date date;

update onboarding_profiles
set incorporation_date = '2025-08-01'
where user_id = '2401b091-747f-4321-a7a5-f84190490ad4'
  and incorporation_date is null;