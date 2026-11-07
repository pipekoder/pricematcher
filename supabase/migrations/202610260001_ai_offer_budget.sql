-- Shared, conservative OpenAI request budget for PR #13.
create table if not exists ai_offer_daily_budget (
  day date primary key,
  request_count integer not null check (request_count >= 0),
  reserved_microusd bigint not null check (reserved_microusd >= 0)
);
