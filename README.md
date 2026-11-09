# PriceMatcher

Transparent Pricing. Verified Offers. Fairer Commerce.

PriceMatcher is an AI-assisted checkout concept for the PayPal AI Hackathon 2026. It combines customer-initiated price comparison, deterministic merchant authorization, and an explicitly approved PayPal Sandbox checkout.

## What works now

- Focused one-page storefront with 19 saved Channel3 running, sneaker and hiking products from seven requested brands, real product-record images, and 171 simulated size SKUs; the original fixture catalog remains isolated
- Product detail pages and a versioned browser-local, size-specific cart
- Guided comparison using clearly labeled fixture data
- Deterministic delivered-price, floor, discount, verification, currency, and expiration checks
- Explicit acceptance of the adjusted or original price
- Server-authorized PayPal Sandbox order creation and capture through the restricted Agent Toolkit adapter
- PayPal JavaScript SDK v6 buyer approval and independent server verification
- Merchant dashboard and browser-only policy preview
- `/api/health`, Render Blueprint, environment template, and unit tests

Fixture comparison remains the safe default and is visibly labeled. PayPal calls occur only when Sandbox credentials are configured and the customer accepts an eligible offer and clicks the PayPal Sandbox action. The application never reports success without a verified provider response.

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
See [Google Shopping observed-price MVP](docs/GOOGLE_SHOPPING_MVP.md) for the isolated Preview setup, shared search budget, data provenance, and manual Sandbox verification limits.
