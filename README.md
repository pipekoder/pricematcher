# PriceMatcher

Transparent Pricing. Verified Offers. Fairer Commerce.

PriceMatcher is an AI-assisted checkout concept for the PayPal AI Hackathon 2026. This repository currently contains the **Foundation** phase: a polished fictional storefront, cart, guided price-comparison checkout, merchant dashboard preview, deterministic pricing rules, fixtures, and deployment scaffolding.

## What works now

- Responsive storefront with six fictional demo products
- Product detail pages and browser-local cart
- Guided comparison using clearly labeled fixture data
- Deterministic delivered-price, floor, discount, verification, currency, and expiration checks
- Explicit acceptance of the adjusted or original price
- Merchant dashboard and browser-only policy preview
- `/api/health`, Render Blueprint, environment template, and unit tests

No live market, AI, database, or payment call is made in this phase. PayPal is visibly disabled; the app never simulates payment success.

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

## Roadmap

1. Foundation (current)
2. Price intelligence: Channel3 adapter, seller/product verification, structured AI assistance
3. PayPal Sandbox: server-created orders and idempotent capture
4. Authenticated merchant policies and Supabase persistence
5. Release hardening, E2E tests, submission package

See [Render deployment](docs/RENDER_DEPLOYMENT.md). Do not use PayPal Live credentials for this project.
