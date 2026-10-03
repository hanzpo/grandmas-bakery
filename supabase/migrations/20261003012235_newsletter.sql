-- Weekly "what's new" newsletter.
-- Each customer gets a stable token for one-click unsubscribe links.
alter table customers add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists customers_unsubscribe_token_idx on customers (unsubscribe_token);

create table newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  note text,                    -- Grandma's personal note at the top
  recipients int not null default 0,
  failed int not null default 0,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users (id) on delete set null
);

alter table newsletter_issues enable row level security;
create policy "staff full access" on newsletter_issues for all to authenticated using (is_staff()) with check (is_staff());
