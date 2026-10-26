# End-to-end PriceMatcher Sandbox demo

The main storefront displays five real Channel3 product families. NORTH/01 prices are fictional demo merchant prices, configured in `lib/catalog.ts`: Nike $89, Sony $329, Apple $299, Garmin $479, and Nintendo $429. The preserved fixture catalog remains available to tests and fixture comparison flows.

## Flow and boundaries

1. Choose a product, add it to cart, and set quantity.
2. At checkout, select Match lowest, Partial reduction, or Keep original. The deterministic `OfferProposer` uses saved Channel3 product prices as a controlled reference. It is not an AI agent.
3. The server validates the proposed unit price against the demo merchant policy: product floor, maximum discount, optional cost margin, enabled decision types, quantity, and offer expiry. Rejected proposals can be retried up to the configured limit; otherwise the original price is retained.
4. The server stores an authorized offer bound to its session, cart fingerprint, quantities, policy version, expiration, and USD total. The browser never supplies an offer amount.
5. Accept Offer & Checkout accepts that record. Keep Original Price & Checkout creates a separate original-price record with no demo discount assumptions.
6. Before PayPal order creation, the server checks the accepted offer, session, policy version, expiration, and stored payment amount again. PayPal Sandbox capture remains idempotent and independently verified by the existing payment service.

The saved Channel3 snapshots have 5 families, 14 records and 26 offers. They do not verify exact product variants, shipping, or mandatory fees. The demo policy's identity and delivered-cost assumptions are explicitly labeled and enabled only when `PRICEMATCHER_DEMO_ASSUMPTIONS=1` and `PAYPAL_ENVIRONMENT=SANDBOX`. The demo discount merchant policy uses a separate identity from fixture and original-price checkout. Live evidence without those assumptions cannot authorize a discount.

The proposer interface is `OfferProposer.propose(context): Promise<OfferProposal>`. A future AI implementation can replace the demo proposer while leaving server-side policy authorization and PayPal handling intact.

## Final security audit

Trust boundaries: the browser sends only product IDs, quantities, the cart variant key, and a scenario selector. The server resolves USD prices from its catalog, reads saved Channel3 evidence, runs the proposer, and independently validates the proposal. The policy floor and maximum discount are enforced with integer minor units; optional cost data adds a minimum margin floor. A rejected proposal is never rewritten into a different discount. The original-price route uses its own merchant policy identity and requires zero discount at payment preparation.

An offer is stored with its session, cart fingerprint, item quantities, policy version, expiration, and final total. The accept endpoint rejects missing, revoked, consumed, expired, or altered offers. Checkout preparation rechecks the cart and each item. Immediately before PayPal order creation, the server checks the accepted offer, session, policy version, expiration, USD currency, and positive authorized amount. PayPal order and capture IDs come from server-side transaction records; the capture path compares the expected order, amount, currency, status, and transaction ID and handles retries idempotently. The Agent Toolkit is configured for Sandbox only.

Audit fixes include persisting a comparison record before its PostgreSQL-backed demo offer, binding the demo price reference to the actual saved lowest new offer, refusing forged original-price discounts, and rejecting zero or negative stored payment amounts.

Example policy: Nike demo merchant price $89.00; minimum price $55.00; maximum discount 40%; no cost basis currently configured. A $55.99 match and a partial reduction between $55.99 and $89.00 pass. A $50.00 proposal fails the minimum price rule. If cost data is configured, the 10% minimum margin adds a further floor. These are controlled Sandbox demonstration terms, not real merchant offers.

## Environment

- `PRICEMATCHER_DEMO_ASSUMPTIONS=1` enables the controlled demo offer path.
- `PAYPAL_ENVIRONMENT=SANDBOX`, `PAYPAL_CLIENT_ID`, and `PAYPAL_CLIENT_SECRET` configure the existing Sandbox payment provider. Never use live credentials.
- `CHANNEL3_API_KEY` and `NODE_USE_ENV_PROXY=1` are needed for live Channel3 provider calls. The controlled scenario currently reads the verified saved snapshot so it remains reproducible without a live search.
- Shared deployments require `PERSISTENCE_BACKEND=postgres`, `DATABASE_URL`, and the existing database TLS settings. Local development can use the file repository.
- For Render, set `APP_ENV=production`, `PERSISTENCE_BACKEND=postgres`, a test or demo `DATABASE_URL`, `DATABASE_SSL=require`, and a trusted `DATABASE_SSL_CA` or `DATABASE_SSL_CA_BASE64` if required by the database provider. Keep all credentials server-only. Configure `PRICE_DISCOVERY_MODE` explicitly for any non-demo route.

## Manual QA, without executing a payment in automated tests

1. Configure the environment above with PayPal Sandbox credentials and a persistent repository. Start the app.
2. Add Nike Downshifter 14 to the cart. Increase quantity to two and continue to checkout.
3. Select **Match lowest** and click **Check prices**. Confirm the saved market offers are labeled as product prices with unknown shipping and fees, then inspect the demo proposal and expiration.
4. Click **Accept consolidated offer**. Confirm the checkout total equals the authorized total, then use the PayPal Sandbox buyer account to approve and capture. Confirm the server reports the capture as verified. Do not use a live PayPal account.
5. Repeat with **Partial reduction** and **Keep original**. For the independent original path, click **Continue at original price** without accepting a proposal; confirm the original cart total is retained.
6. Change a cart quantity after accepting an offer, wait past its expiration, and retry. Each case should require a fresh authorization. Attempting to submit a browser-controlled amount to the strict checkout API should be rejected.
7. Check desktop and narrow mobile widths for readable product, market, cart, offer, and PayPal sections.

Automated tests use isolated payment mocks. No real PayPal Sandbox capture was performed during implementation.

## Rollback and remaining limits

To roll back, disable `PRICEMATCHER_DEMO_ASSUMPTIONS` first so no new discounted demo offers can be issued or prepared, then redeploy the prior known-good revision. Existing PayPal orders should be reconciled through their server-side transaction records before any database rollback. Do not delete audit records or payment attempts. The Channel3 snapshot is historical; exact variant and delivered-cost evidence remain unavailable. In the audit environment, no safe PostgreSQL test database or PayPal Sandbox credentials were configured, so the PostgreSQL integration test and a real Sandbox capture remain unverified.
