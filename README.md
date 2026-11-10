# Deal Engine
### AI-powered deal-making at checkout

**Built for the PayPal AI Hackathon 2026**

**[Try the live demo](https://pricematcher-one.vercel.app/) · [Explore the repository](https://github.com/pipekoder/pricematcher)**

Deal Engine explores a different approach to e-commerce pricing. Instead of treating the displayed retail price as the only possible checkout price, it lets a merchant use market observations and AI-assisted commercial analysis to propose a better deal, subject to merchant-controlled pricing rules.

The project is demonstrated through **SOLE**, a fictional curated footwear boutique. Customers can run Deal Engine at checkout, review an authorized offer, and complete a **PayPal Sandbox** payment. Original-price checkout is available independently of the AI workflow.

> **The idea:** What if checkout could become an intelligent negotiation between customer value, market competition, and merchant profitability?

## Live Demo

**[Launch SOLE / Deal Engine](https://pricematcher-one.vercel.app/)**

No storefront registration is required. To explore the end-to-end demo:

1. Choose a running shoe, sneaker, or hiking shoe and select an available EU size.
2. Add it to the shopping bag and proceed to checkout.
3. Click **Start Deal Engine** and follow the live activity from Channel3, Meta Muse Spark agents, and merchant policy validation.
4. Review the resulting offer and its expiry countdown. Accept an authorized offer, or keep the original SOLE price.
5. Use a **PayPal Sandbox buyer account** to approve the simulated payment and return to the confirmation screen.

AI availability and pricing results depend on enabled integrations, configured budgets, market evidence, product choices, and merchant rules. A discount is not guaranteed. **No real-money payment is intended.** Do not publish Sandbox buyer passwords in this repository.

## The Problem

Shoppers often leave checkout to compare prices across retailers, while merchants must balance competitive pricing, product demand, stock, and profit. Blanket discounts can undermine margins; rigid price matching cannot easily reflect commercial context.

Deal Engine explores a more adaptive approach:

- **For shoppers:** Potentially better prices without leaving checkout.
- **For merchants:** Pricing recommendations informed by market observations, simulated demand, and profitability constraints.
- **For commerce:** A visible, AI-assisted negotiation that ends in deterministic merchant authorization and a verified Sandbox checkout.

## How Deal Engine Works

**Shop → Start Deal Engine → Analyze → Validate → Accept or Keep Original → PayPal Sandbox**

### 1. Shop at SOLE

The storefront presents **19 saved Channel3 footwear product records** from seven brands, with product-record imagery and **171 simulated size-specific SKUs**. Shoppers use quick views, product details, and a size-specific shopping bag.

### 2. Start Deal Engine

At checkout, a customer starts a voluntary comparison. The server validates the cart, product identities, variants, stock, and original amounts before asking the AI agents to advise.

Channel3 supplies competitor product-price observations. Product discovery is not repeated on storefront page load; the optional exact-product lookup runs when the customer initiates the enabled comparison workflow.

### 3. Analyze with two AI agents

Both agents run on **Meta Muse Spark 1.3** through an OpenAI-compatible Responses API integration.

- **Agent A — Inventory & Sales Advisor:** Reviews simulated inventory, sales, returns, demand indicators, product costs, and pricing-policy facts. It advises on the commercial discount strategy.
- **Agent B — Offer Proposal Agent:** Combines Agent A's structured advice with eligible Channel3 observations and bounded product facts. It recommends a pricing decision and integer-cent unit price for each cart line.

Channel3 is a **market data provider, not an AI agent**. Agent A and the Channel3 lookup can run concurrently. Neither agent can change merchant policy, authorize a payment, or bypass the server validator.

### 4. Validate merchant rules

A deterministic **Policy Validator** checks proposals against actual server-side constraints:

- Product and SKU identity
- Size-specific inventory availability
- Cost and minimum selling-price floors
- Maximum discounts and inventory-sensitive pricing rules
- Eligible market-price references
- Exact cart line sets, quantities, and totals
- Offer and session validity

An invalid proposal is rejected. Original-price checkout remains available even when the AI, market lookup, or authorization fails. The server also revalidates offers before acceptance and payment preparation.

### 5. Review and accept

When a compliant offer is issued, checkout shows the final authorized total, potential savings, and a live **MM:SS** countdown derived from the server's expiry timestamp. The customer can accept it before expiry or keep the original price.

### 6. Complete PayPal Sandbox checkout

PayPal Sandbox provides buyer approval. The backend prepares the server-authorized amount, protects against duplicate capture, and independently verifies the payment outcome. The app does not treat an AI recommendation or a client-side callback as payment authorization.

## Three Possible Pricing Outcomes

Each product can receive one of three AI-recommended decisions, subject to merchant validation.

| Decision | What it means |
| --- | --- |
| **Match the Lowest Price** (`MATCH_LOWEST`) | Match the lowest eligible observed competitor **product price**, when merchant rules permit. |
| **Offer a Lower Price** (`PARTIAL_MATCH`) | Offer a discount below the original SOLE product price but above the eligible competitor reference, while respecting merchant floors. |
| **Keep the Original Price** (`KEEP_ORIGINAL`) | Maintain the current price when no lower offer is suitable or authorized. |

For example, with a **$100** original product price and **$85** eligible market observation, the possible outcomes might be **$85**, **$92**, or **$100** respectively. This example is illustrative, excludes shipping and tax, and is not a promise of any particular result.

The system does **not** claim that observed competitor prices are verified final delivered prices: size equivalence, availability, shipping, and other fees can be unknown. Authorized discounts in this project are explicitly **Sandbox-only demo assumptions**.

## Live AI & Tool Execution Monitor

The checkout shows a real execution monitor rather than an opaque loading animation:

- Current tool / AI model and its activity
- Running, completed, failed, and skipped stages
- Real elapsed time and stage-based progress
- Customer-safe activity entries

| Tool or component | Responsibility |
| --- | --- |
| **Channel3 API** | Retrieve competitor product-price observations |
| **Meta Muse Spark 1.3 — Agent A** | Analyze simulated inventory and sales context |
| **Meta Muse Spark 1.3 — Agent B** | Propose commercially appropriate prices |
| **Deal Engine Policy Validator** | Check merchant pricing and eligibility rules |
| **Deal Engine Authorization** | Issue the server-authorized offer |
| **PayPal Sandbox** | Buyer approval and verified payment |

The comparison uses **Server-Sent Events (SSE)** on the existing `POST /api/comparisons` path when requested; compatible non-streaming callers continue to receive JSON. Events reflect real backend milestones, not a fabricated percent or estimated completion time.

If a stream disconnects, the frontend does not automatically repeat a potentially billable AI request. The customer can still use original-price checkout. Long-running streams remain subject to network and serverless execution limits.

## Architecture

```text
SOLE Storefront
      |
Shopping Bag & Checkout
      |
Start Deal Engine
      |
      +-------------------------+
      |                         |
      v                         v
Channel3 market search     Meta Muse Spark Agent A
      |                    Inventory & sales advice
      +------------+------------+
                   |
                   v
            Meta Muse Spark Agent B
                Price proposal
                   |
                   v
       Deterministic Policy Validator
                   |
                   v
         Server-authorized offer
                   |
          +--------+--------+
          |                 |
     Accept offer      Keep original
          |                 |
          +--------+--------+
                   |
                   v
             PayPal Sandbox
                   |
                   v
        Server payment verification
```

**Original-price checkout has an independent authorization path** and does not require Channel3 or AI to succeed.

### Technology Stack

| Layer | Technology |
| --- | --- |
| Application | Next.js 16, React 19, TypeScript |
| Presentation | CSS and Tailwind CSS 4 |
| AI models | Meta Muse Spark 1.3 |
| Model integration | OpenAI-compatible Responses API client |
| Market intelligence | Channel3 SDK / API |
| Payments | PayPal Agent Toolkit 1.11.0, PayPal JavaScript SDK v6, PayPal Orders API |
| Persistence | PostgreSQL / Supabase |
| Deployment | Vercel; Render configuration also included |
| Tests | Vitest, TypeScript, ESLint, PostgreSQL integration tests |

### Repository Structure

| Path | Purpose |
| --- | --- |
| `app/` | Storefront, checkout, merchant routes, and APIs |
| `components/` | Retail, cart, comparison, progress, and payment UI |
| `agents/` | Agent instruction files |
| `lib/ai-offers/` | Two-agent orchestration, validation, budgets, and progress |
| `lib/footwear/` | Simulated SKU, stock, and sales context |
| `lib/price-intelligence/` | Market integration and comparison logic |
| `lib/persistence/` | Repository and PostgreSQL persistence |
| `docs/` | Technical, deployment, and test documentation |

## Demo Data, Security & Limitations

**Based on Channel3 records:** Product identities, imagery, and saved historical market observations. The exact market lookup may fetch additional observations when enabled.

**Simulated for the Hackathon:** SOLE selling prices, EU-size stock, acquisition costs, sales, returns, inventory movements, and pricing context. These do not represent a real retailer's ERP, real-time inventory, or guaranteed competitor checkout prices.

AI outputs are **untrusted recommendations**. Server checks enforce SKU and stock constraints, inventory-based selling-price floors, merchant policy, session/cart binding, expiry, evidence validity, and arithmetic consistency. Merchant policy cannot be edited by the AI agents.

The workflow includes controlled AI request budgets, sanitized progress events, idempotency safeguards, and server-side payment verification. Customer-facing logs omit API credentials, agent prompts, hidden reasoning, merchant cost values, and sensitive session information.

**AI proposes. Merchant rules decide.**

This is a Hackathon prototype, **not a production-ready price guarantee or real-money payment service**.

## Run Locally

### Prerequisites

- Node.js **24+** and npm
- PostgreSQL and a secure session secret for shared, payment-capable environments
- PayPal **Sandbox** credentials for payment testing
- Meta Model API / Channel3 credentials only when enabling those integrations

```bash
git clone https://github.com/pipekoder/pricematcher.git
cd pricematcher
npm install
cp .env.example .env.local
npm run dev
```

Open **http://localhost:3000**. The storefront can be inspected without turning on external AI or payment calls.

### Environment Configuration

Refer to [`.env.example`](.env.example) for the authoritative configuration and defaults. Important server-only settings include:

```dotenv
# Meta Model API — optional, potentially billable
MODEL_API_KEY=
AI_OFFER_AGENT_ENABLED=false
AI_OFFER_MAX_CALLS_PER_DAY=40
AI_OFFER_MAX_ESTIMATED_SPEND_USD=1

# Channel3 exact-product retrieval — optional, rate-limited
CHANNEL3_API_KEY=
CHANNEL3_EXACT_LOOKUP_ENABLED=0
CHANNEL3_EXACT_MAX_REQUESTS_PER_DAY=10

# PayPal is intentionally Sandbox-only
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=SANDBOX

# Persistence and signed anonymous sessions
PERSISTENCE_BACKEND=local
DATABASE_URL=
PRICE_MATCHER_SESSION_SECRET=

# Explicit Sandbox-only pricing assumptions
PRICEMATCHER_DEMO_ASSUMPTIONS=0
```

Production-style shared deployments require persistent PostgreSQL, relevant migrations, strong session signing, and correctly configured secrets. AI mode requires explicit enabling and can consume Meta credits; do not enable it merely to inspect the UI. **Never commit API keys or use PayPal Live credentials.**

## Quality Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

PostgreSQL integration tests require a dedicated migrated test database configured through `TEST_DATABASE_URL`:

```bash
npm run test:postgres
```

Tests mock external AI, Channel3, and PayPal requests where appropriate and should not make billable external API calls as part of routine CI.

## Current Capabilities

- Curated SOLE footwear storefront and size-specific shopping bag
- Channel3 market observations and optional live exact-product lookup
- Two Meta Muse Spark AI pricing agents
- Three pricing decisions: full match, partial match, or original price
- Deterministic merchant policy validation and offer authorization
- Live tool/model progress with SSE and elapsed timer
- Server-based offer-expiration countdown
- Independently authorized original-price checkout
- PayPal Sandbox approval, capture, and server verification
- Protected merchant diagnostics and PostgreSQL-backed workflow

## Future Development

Further work could include stronger live variant verification, complete delivered-price comparisons, integrations with actual merchant inventory and sales, merchant-managed pricing policies, robust browser/payment E2E coverage, and streaming reliability improvements.

## Documentation

- [Dual AI Offer Agents](docs/DUAL_AI_OFFER_AGENTS.md)
- [Channel3 Live Price-Match Workflow](docs/CHANNEL3_LIVE_PRICE_MATCH.md)
- [PayPal Agentic Checkout](docs/PAYPAL_AGENTIC_CHECKOUT.md)
- [Vercel + Supabase Deployment](docs/VERCEL_SUPABASE_MIGRATION.md)
- [Render Deployment](docs/RENDER_DEPLOYMENT.md)

---

**Deal Engine — AI-powered deal-making at checkout.**

*Built for the PayPal AI Hackathon 2026. SOLE is fictional, merchant data is simulated, and checkout uses PayPal Sandbox only.*
