-- PR #4 shared persistence additions. Apply after 202610240001.
alter table comparison_requests add column if not exists record jsonb not null default '{}'::jsonb;
alter table authorized_offers add column if not exists record jsonb not null default '{}'::jsonb;
alter table offer_acceptances add column if not exists record jsonb not null default '{}'::jsonb;

create table transaction_audit_events (
  id uuid primary key,
  offer_id uuid not null references authorized_offers(id),
  checkout_attempt_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table checkout_attempts (
  id uuid primary key,
  offer_id uuid not null references authorized_offers(id),
  merchant_id text not null,
  session_id uuid not null,
  provider text not null check (provider = 'paypal_sandbox'),
  idempotency_key uuid not null,
  expected_amount_minor bigint not null check (expected_amount_minor >= 0),
  currency char(3) not null,
  status text not null check (status in ('prepared','order_created','buyer_approved','capture_pending','captured','failed','reconciliation_required','reconciled')),
  provider_order_id text,
  provider_transaction_id text,
  failure_code text,
  reconciliation_status text not null check (reconciliation_status in ('not_required','pending','matched','mismatch')),
  instruction jsonb not null,
  record jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (offer_id),
  unique (idempotency_key),
  unique (provider, provider_order_id),
  unique (provider, provider_transaction_id)
);

alter table transaction_audit_events add constraint transaction_audit_checkout_fk foreign key (checkout_attempt_id) references checkout_attempts(id);
create index comparison_requests_session_created_idx on comparison_requests(session_id,created_at desc);
create index competitor_evidence_comparison_idx on competitor_evidence(comparison_id,retrieved_at desc);
create index authorized_offers_expiry_idx on authorized_offers(status,expires_at);
create index checkout_attempts_session_created_idx on checkout_attempts(session_id,created_at desc);
create index checkout_attempts_status_idx on checkout_attempts(status,updated_at);
create index transaction_audit_offer_created_idx on transaction_audit_events(offer_id,created_at,id);

alter table checkout_attempts enable row level security;
alter table transaction_audit_events enable row level security;

-- No browser policies are created. These tables are accessible only through the
-- server database role. The repository uses BEGIN/COMMIT plus SELECT ... FOR UPDATE.
revoke all on checkout_attempts, transaction_audit_events from anon, authenticated;

create function reject_audit_mutation() returns trigger language plpgsql as $$
begin raise exception 'transaction audit events are append-only'; end $$;
create trigger transaction_audit_append_only before update or delete on transaction_audit_events for each row execute function reject_audit_mutation();
