-- Shared, fail-closed request accounting across Vercel function instances.
create table if not exists google_shopping_daily_budget (
  day date primary key,
  request_count integer not null check (request_count >= 0)
);
create table if not exists google_shopping_search_batches (
  id uuid primary key,
  session_id uuid not null,
  product_id text not null,
  variant_key text not null,
  provider text not null check (provider = 'serpapi_google'),
  requested_at timestamptz not null,
  completed_at timestamptz,
  status text not null,
  result_count integer,
  sponsored_count integer,
  latency_ms integer
);
create index if not exists google_shopping_batches_session_idx on google_shopping_search_batches(session_id, requested_at desc);
alter table google_shopping_daily_budget enable row level security;
alter table google_shopping_search_batches enable row level security;
