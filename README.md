# Deal Engine — SOLE demo storefront

AI-powered deal-making at checkout.

Deal Engine is an AI-assisted merchant decision and checkout negotiation workflow for the PayPal AI Hackathon 2026. SOLE is its fictional, curated footwear demo boutique. The existing repository, technical identifiers and API routes retain their PriceMatcher names.

## What works now

- Focused one-page storefront with 19 saved Channel3 running, sneaker and hiking products from seven requested brands, real product-record images, and 171 simulated size SKUs; the original fixture catalog remains isolated
- Homepage product quick views, a right-side shopping bag drawer, direct product detail URLs, and one canonical versioned, size-specific cart
- Guided comparison using clearly labeled fixture data
- Deterministic delivered-price, floor, discount, verification, currency, and expiration checks
- Optional acceptance of an adjusted price; original-price PayPal Sandbox checkout is independently authorized and available without a price check
- Server-authorized PayPal Sandbox order creation and capture through the restricted Agent Toolkit adapter
- PayPal JavaScript SDK v6 buyer approval and independent server verification
- Customer-started Deal Engine progress over the existing `/api/comparisons` POST (SSE when requested), with backend-confirmed Channel3/Meta/policy stages and an absolute server-expiry countdown
- Merchant dashboard and browser-only policy preview
- `/api/health`, Render Blueprint, environment template, and unit tests

Fixture comparison remains available and visibly labeled. PayPal calls occur only when Sandbox credentials are configured and the customer clicks the PayPal Sandbox action, whether they selected a valid Deal Engine offer or kept the original price. The application never reports success without a verified provider response.

The footwear checkout requests a streamed comparison from the same pricing path; non-streaming callers and fixture comparisons still receive JSON. A disconnected stream does not automatically replay the request or start another billable lookup. The UI reports an uncertain comparison and leaves original-price checkout available. The activity log contains only allowlisted stage/status metadata, not prompts, credentials or merchant cost data. Elapsed time is measured, not a predicted completion percentage; Vercel function execution and network delivery can still interrupt a long-running stream.

## Outdoor footwear demo (PR #12)

The storefront uses saved Channel3 product identities, images, and observed new-product prices; it does not call Channel3 on page load. Product size inventory, merchant prices, transactions, returns, inventory movements, and 90-day price history are synthetic. The 60-day sales ledger and inventory movements are deterministic and reconcile by SKU. These are not claims of real merchant availability or sales. The original 10 authenticated discovery requests are recorded in `docs/CHANNEL3_PR12_REQUEST_LOG.json`; one additional Adidas query for this focused demo is recorded in `docs/CHANNEL3_RUNNING_DEMO_LOG.json`. Do not rerun either discovery script without a new, scoped need.

The home page is a single-page shop; individual product detail and checkout routes remain. The product page shows saved product-only market quotes and a clearly labeled difference, not an actionable delivered-price match or authorized discount. Exact EU sizes are simulated; the PriceMatcher offer is requested and server-authorized at checkout. Products without an associated real Channel3 image are excluded from the main shop. The older `/channel3-demo` and Merchant Demo routes remain available.

Select an in-stock EU size on a product page, add it to the bag, then check prices at checkout. Distinct sizes are distinct cart lines. The server validates each size and current simulated stock and derives original prices and all totals from its catalog. Demo proposal modes are MATCH_LOWEST, PARTIAL_MATCH, and KEEP_ORIGINAL; observed competitor shipping and fees remain unknown, so any demo discount is explicitly a Sandbox-only assumption. Alternatively, continue at the independently authorized original price. The existing `/channel3-demo` and merchant routes remain available.

To enable only the clearly labeled Sandbox proposal demonstration, set `PRICEMATCHER_DEMO_ASSUMPTIONS=1` with `PAYPAL_ENVIRONMENT=SANDBOX`. Keep it disabled elsewhere. PayPal credentials, a session-signing secret, and persistent PostgreSQL are required for a shared payment-capable deployment; local development can inspect the storefront without them. Never use live PayPal credentials here. No payment was executed during PR #12 implementation.

## Local setup

Requires Node.js 24+.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The guided checkout also works with an empty cart.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Architecture

- `app/` — Next.js App Router pages and API routes
- `components/` — reusable retail, cart, and PriceMatcher UI
- `lib/catalog.ts` — fictional catalogue fixture
- `lib/demo-data.ts` — labeled competitor and policy fixtures
- `lib/pricing.ts` — UI-independent deterministic decision engine

Core calculations are separate from presentation so later adapters can supply verified data without granting those providers authority over merchant rules.

### Demo pricing strategy

The fixture merchant uses a configurable `match` strategy. The policy also supports `better_by_fixed_amount`; caps and per-product floors are enforced by the server pricing engine. Offers are actionable only for exact product and variant evidence after every eligibility rule passes.

## Roadmap

1. Foundation (current)
2. Price intelligence: Channel3 adapter, seller/product verification, structured AI assistance
3. PayPal Sandbox: server-created orders and idempotent capture (current)
4. Authenticated merchant policies and Supabase persistence
5. Release hardening, E2E tests, submission package

See [Render deployment](docs/RENDER_DEPLOYMENT.md). Do not use PayPal Live credentials for this project.
See [Vercel migration while keeping Supabase](docs/VERCEL_SUPABASE_MIGRATION.md) for the separate-account deployment checklist.
See [PayPal agentic checkout](docs/PAYPAL_AGENTIC_CHECKOUT.md) for Sandbox setup and manual verification.
See [Dual AI Offer Agents](docs/DUAL_AI_OFFER_AGENTS.md) for the optional two-agent Sandbox workflow, merchant policy, budget and security boundaries.
See [Channel3 live price-match workflow](docs/CHANNEL3_LIVE_PRICE_MATCH.md) for exact product retrieval, request budget, evidence provenance, and Sandbox verification limits.
