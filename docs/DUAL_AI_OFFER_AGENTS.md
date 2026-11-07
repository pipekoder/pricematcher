# Dual AI Offer Agents — Muse Spark 1.3

## Trust boundary and customer journey

Shop → Bag → Check Prices → Final Offer → Accept or Keep Original → PayPal Sandbox. The saved 19-record Channel3 footwear catalog, 171 simulated size SKUs, cart fingerprint, original-price checkout, and PayPal server authorization are retained. The consumer does not select an internal pricing scenario.

On a footwear price check, the server validates product, size, SKU stock, quantity, currency and merchant prices before any model call. It uses saved Channel3 market snapshots; no new product discovery occurs. A bounded, server-generated JSON fact set (maximum six cart lines) goes to Agent A. Agent A advises on demand and margin. Agent B sees those facts and Agent A's structured advice and proposes one decision and integer-cent unit price per line plus a consolidated subtotal. The server rejects incomplete line sets, invalid totals, insufficient stock, stale market evidence, below-cost prices and merchant-policy violations. At most one sanitized revision request goes to Agent B. A failed model call or second invalid proposal yields no adjusted offer; independently authorized original-price checkout remains available.

The agents cannot save policies, inventory or payments. Their output is untrusted even when it conforms to the requested JSON schema. Acceptance and PayPal order preparation recompute the cart and AI policy from server records, and check session, offer status, expiration, SKU identity, evidence, and authorized totals. No live-money discount is allowed from variant-incomplete evidence: AI offers require explicit Sandbox demo assumptions.

## Agent instructions and model

The server uses the OpenAI-compatible JavaScript SDK pointed at Meta Model API (`https://api.meta.ai/v1`) and fixes the model to `muse-spark-1.3` in Standard mode. This spends Meta Model API credit, not OpenAI or Vercel AI Gateway credit. Meta documents [Responses API compatibility](https://dev.meta.ai/docs/protocols/responses) and [strict JSON Schema output](https://dev.meta.ai/docs/api-reference/responses/schemas). `agents/inventory-sales/SKILL.md` and `agents/market-offer/SKILL.md` are read from disk and supplied as instructions for their respective calls. Product descriptions, retailer prose, and URLs are not supplied as instructions or in the model fact set. Strict JSON schemas are requested and Zod independently validates returned data. No live Meta call or billable evaluation was made during this migration; a missing key or API failure safely falls back to the original price.

## Merchant policy examples

- Overstock/no sales: product stock >50 and zero sales in 30 days. Merchant selects a 5% or 10% above-cost minimum with `AI_OVERSTOCK_MARKUP_BPS` (500 or 1000).
- Scarce/active: product stock <10 and sales on at least `AI_ACTIVE_SALES_DAYS` distinct days in 30 days. Floor is `max(cost, 85% of original retail)`.
- Normal: existing minimum-price and maximum-discount constraints apply, never below simulated acquisition cost.

The selected SKU must always have enough simulated stock. AI recommendations cannot change these conditions. The market's unknown shipping, fees and size equivalence remain explicitly unverified. A saved product-price reference can support only a clearly labeled Sandbox assumption, not an exact delivered-price match.

## Cost and latency controls

One-item checks use at most two initial model calls (one per agent); only a rejected proposal permits one extra Agent B call. Up to six lines are batched in those same calls. Requests use a 12-second timeout, zero automatic SDK retries, `store:false`, and a 1,400-output-token cap. Agent A insights are cached for five minutes on unchanged facts. Repeated identical session/cart checks reuse an offer for 60 seconds while still issued. Per-process concurrency is limited to two. Development has an in-memory daily call/spend guard; production uses the atomic `ai_offer_daily_budget` PostgreSQL table from migration `202610260001_ai_offer_budget.sql`. A production database failure denies model calls.

The application conservatively reserves $0.05 per model request and defaults to 40 calls and $1 estimated daily spend. The usage log contains model, input/output token counts, elapsed time and an **illustrative** estimate using Meta's published Standard-mode $1.25/M input and $4.25/M output token rates, [subject to change](https://dev.meta.ai/models/muse-spark). This estimate is not a billing guarantee. For a two-call check, the reserved application budget is $0.10; a single revision raises it to $0.15. Configure a project-level Meta budget and alerts separately—dashboard budgets may not be hard stops. Do not buy credits or enable auto-recharge for this demo.

## Internal diagnostics

When a footwear comparison falls back before calling the model, the server writes one `ai_offer_gate_disabled` warning to the Vercel Function logs. Its `checks` object contains only booleans (`agentEnabled`, `modelKeyConfigured`, `demoAssumptionsEnabled`, `paypalSandbox`); it never contains the key, environment-variable values, cart, or session. Filter logs for this event after a single Check Prices request to identify which prerequisite the deployed function actually sees. This event means no Meta API request was made. Remove the temporary gate warning after resolving the deployment configuration.

`/merchant/operations` shows simulated cost/stock/sales and the latest Agent A recommendation, Agent B proposal, policy outcome and final authorized unit. It requires Basic authentication (`merchant` as username, `MERCHANT_DEMO_ACCESS_TOKEN` as password, minimum 24 characters). The proxy returns 401 without credentials; the server layout independently withholds the data. The latest agent diagnostic is process-local and not a durable audit record. The public Merchant Demo and `/channel3-demo` routes remain available. Customer responses contain only safe explanations and a minimal offer ID/total/expiry, never acquisition costs, policies, prompts or model diagnostics.

## Automated validation

Mocked Agent A/B tests cover the three decisions, policy floors, invalid proposals, timeouts, rate limits, malformed output, conflicting advice, SKU substitution, multi-item totals, repeated checks, expiration, offer reuse, original-price isolation and payment amount integrity. Meta transport tests verify the endpoint, model, strict JSON format, and zero automatic retries without calling the API. PostgreSQL integration tests require `TEST_DATABASE_URL`. Live Meta Model API and PayPal Sandbox payments were not tested.

## Vercel setup (separate account)

1. Apply all committed Supabase/PostgreSQL migrations, including `202610260001_ai_offer_budget.sql`, to a dedicated test/staging database.
2. Configure `APP_ENV=production`, `PERSISTENCE_BACKEND=postgres`, `DATABASE_URL`, TLS settings, and a 32+ character `PRICE_MATCHER_SESSION_SECRET` per existing deployment documentation.
3. In the separate Vercel account, configure server-only `MODEL_API_KEY` from Meta Model API; never paste it into chat or GitHub. The model and endpoint are fixed in code. The old `OPENAI_*` variables are ignored. After confirming the budget and test environment, set `AI_OFFER_AGENT_ENABLED=1`, `PRICEMATCHER_DEMO_ASSUMPTIONS=1`, and `PAYPAL_ENVIRONMENT=SANDBOX` only for the explicit Sandbox demonstration. Keep the agent disabled until a deliberate billable test is approved.
4. Set `AI_OVERSTOCK_MARKUP_BPS` to `500` or `1000`, `AI_ACTIVE_SALES_DAYS` to a positive 1–30 value, `AI_OFFER_TIMEOUT_MS=12000`, `AI_OFFER_MAX_CALLS_PER_DAY=40`, and `AI_OFFER_MAX_ESTIMATED_SPEND_USD=1`. Set a long random `MERCHANT_DEMO_ACCESS_TOKEN`.
5. Configure existing PayPal **Sandbox** client credentials. Never enter live PayPal credentials. Confirm health and environment readiness before allowing users to test checkout. No deployment was performed in this PR.

## Manual QA (not performed here)

1. Overstock/no sales: inspect an overstocked, unsold model in the protected operations page; choose an in-stock EU size and click Check Prices. Verify Agent A flags stagnant/overstock, Agent B proposes a compliant discount or retains original, and the policy floor is never below configured cost markup.
2. Scarce/active: use a controlled test fixture with total stock below 10 and sufficient distinct selling days. Check that any offer is at least cost and 85% of original price. Do not mutate the saved storefront inventory to manufacture this case.
3. Normal: select a normally stocked model, compare, and verify the original-price and approved-offer choices have distinct authorization records. Change size or quantity after checking: the old offer must be rejected.

For each, test a repeated Check Prices request and inspect sanitized usage logs. With the agent disabled, there must be no model call and original-price checkout must still work. Run an explicit live three-scenario evaluation only after valid API credentials, model support, budget and billable-call authorization are confirmed.

### PayPal Sandbox QA (not executed here)

Using buyer and merchant Sandbox accounts only: accept an authorized offer, inspect the displayed total, click the PayPal Sandbox checkout action, approve in the buyer Sandbox window, and verify the server's returned order amount and capture status match the authorized offer. Repeat the prepare request with the same idempotency key; it must not create a second attempt. Attempt a changed SKU, quantity, stale offer, reused acceptance, and browser-modified amount; all must fail before PayPal order creation. Repeat at original price and confirm no AI discount applies. Never run these steps against a live PayPal account.

## Rollback and limitations

Set `AI_OFFER_AGENT_ENABLED=false` to stop model calls immediately; original-price checkout continues. Revert the PR to remove the UI and service path if needed; retain the budget table for audit or drop it separately after confirming no deployments use it. No Meta key was configured in the development environment, so live model behavior remains unverified. Channel3 snapshots are cached, variant-incomplete, and have unknown shipping/fees. Inventory, acquisition cost, sales, returns and NORTH/01 retail prices are simulated. Mocked tests do not prove live model quality or a real PayPal Sandbox payment.
