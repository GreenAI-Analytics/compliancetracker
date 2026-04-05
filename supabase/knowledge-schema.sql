create extension if not exists "uuid-ossp";

create table if not exists knowledge_articles (
  id uuid primary key default uuid_generate_v4(),
  article_id text not null unique,
  title text not null,
  country varchar(2) not null,
  category text not null,
  tags text[] not null default '{}',
  last_updated date,
  slug text not null,
  source_path text not null unique,
  source_repo text not null default 'compliance-knowledge',
  source_sha text,
  markdown_body text not null,
  summary text,
  is_active boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint knowledge_articles_country_chk check (country ~ '^[A-Z]{2}$')
);

create index if not exists idx_knowledge_articles_country on knowledge_articles(country);
create index if not exists idx_knowledge_articles_category on knowledge_articles(category);
create index if not exists idx_knowledge_articles_country_category on knowledge_articles(country, category);
create index if not exists idx_knowledge_articles_tags_gin on knowledge_articles using gin(tags);
create index if not exists idx_knowledge_articles_active on knowledge_articles(is_active);

alter table knowledge_articles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'knowledge_articles'
      and policyname = 'knowledge_articles_read_all'
  ) then
    create policy knowledge_articles_read_all
      on knowledge_articles
      for select
      using (is_active = true);
  end if;
end
$$;
