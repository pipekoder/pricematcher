# PriceMatcher

Transparent Pricing. Verified Offers. Fairer Commerce.

PriceMatcher is an AI-assisted checkout concept for the PayPal AI Hackathon 2026. It combines customer-initiated price comparison, deterministic merchant authorization, and an explicitly approved PayPal Sandbox checkout.

## What works now

- Responsive storefront with six fictional demo products
- Product detail pages and browser-local cart
- Guided comparison using clearly labeled fixture data
- Deterministic delivered-price, floor, discount, verification, currency, and expiration checks
- Explicit acceptance of the adjusted or original price
- Server-authorized PayPal Sandbox order creation and capture through the restricted Agent Toolkit adapter
- PayPal JavaScript SDK v6 buyer approval and independent server verification
- Merchant dashboard and browser-only policy preview
- `/api/health`, Render Blueprint, environment template, and unit tests

Fixture comparison remains the safe default and is visibly labeled. PayPal calls occur only when Sandbox credentials are configured and the customer accepts an eligible offer and clicks the PayPal Sandbox action. The application never reports success without a verified provider response.

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
See [PayPal agentic checkout](docs/PAYPAL_AGENTIC_CHECKOUT.md) for Sandbox setup and manual verification.
