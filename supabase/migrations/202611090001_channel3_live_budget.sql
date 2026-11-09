-- Dedicated, atomic Channel3 exact-product request accounting; legacy Google tables remain untouched.
create table if not exists channel3_live_daily_budget (
  day date primary key,
  request_count integer not null check (request_count >= 0)
);
create table if not exists channel3_live_lookup_batches (
  id uuid primary key,
  session_id uuid not null,
  product_id text not null,
  variant_key text not null,
  requested_at timestamptz not null,
  completed_at timestamptz,
  status text not null,
  result_count integer,
  latency_ms integer
);
create index if not exists channel3_live_lookup_session_idx on channel3_live_lookup_batches(session_id, requested_at desc);
alter table channel3_live_daily_budget enable row level security;
alter table channel3_live_lookup_batches enable row level security;
