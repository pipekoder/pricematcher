# Price intelligence and authorized offers

Price checks are customer-initiated. Nothing runs on page load: `POST /api/comparisons` is called only after **Check Price** is clicked. Original-price checkout remains independent.

## Channel3

The server adapter uses official `@channel3/sdk` v4 `products.search`, configured for US/USD. Sources reviewed: [Channel3 API skill](https://github.com/channel3-ai/skills/tree/main/skills/channel3-api), [API reference](https://github.com/channel3-ai/skills/blob/main/skills/channel3-api/references/api-reference.md), and [Channel3 MCP](https://github.com/channel3-ai/channel3-mcp). The documented offer response contains price, URL, domain, availability, and condition, but not shipping or fees. Those fields remain unknown, so policy rejects live evidence when delivered cost cannot be proven. No seller-authenticity claim is inferred.

`PRICE_DISCOVERY_MODE=fixture` is the default. It serves fictional `.example` evidence and is visibly labeled “Fixture mode · Not live market data.” `live` requires a server-only `CHANNEL3_API_KEY`; failures never silently fall back to fixtures. Channel3 advertises a free API key/free tier, but no specific hackathon-credit amount was confirmed in the official material reviewed.

## Decisions and money

Values are integer USD cents. Merchant policy controls eligible products, approved domains, discount cap, product floor, known delivered-cost requirement, strategy (`match` or `better_by_fixed_amount`), and expiration. AI may help classify ambiguity, but only deterministic `exact` evidence creates an offer. The demo’s $135 product plus $4 shipping creates a $139 match for the $149 headphones. The $89 lamp sees a $92 delivered competitor price and remains $89.

## Persistence and security

Repository interfaces isolate persistence. Local development uses an atomic, permission-restricted JSON file with an in-process mutex; tests use memory. Opaque UUID offers snapshot evidence. Acceptance atomically validates ownership, cart fingerprint, expiry, status, and recalculated totals; accepted/consumed offers cannot replay.

For shared deployment, use PostgreSQL/Supabase with the included migration and transaction/row locking for acceptance. Hosted provisioning and credentials remain out of scope.

The future payment boundary is `executeApprovedCheckout(offerId, approvalContext)`. It accepts no client amount: an adapter must load the accepted server offer. No PayPal order or capture code is included.
