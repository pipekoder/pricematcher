# Render deployment guide

This guide prepares the application for a Render Node.js Web Service. Do not deploy or create paid infrastructure without explicit approval.

## 1. Connect GitHub

Push the reviewed feature branch, create a pull request, and connect the repository from the Render dashboard. The included `render.yaml` can create a free-plan Web Service after approval.

## 2. Service settings

- Runtime: Node
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Health check: `/api/health`
- The start script binds Next.js to `0.0.0.0` and Render's `PORT`.

## 3. Environment variables

Copy names from `.env.example` into Render. Never commit values.

- `NEXT_PUBLIC_APP_URL`: public HTTPS URL
- `APP_ENV`: `production`
- `PERSISTENCE_BACKEND=postgres`: mandatory for shared/Render environments
- `DATABASE_URL`: server-only PostgreSQL connection string
- `DATABASE_POOL_MAX`: bounded connection pool size (default `10`)
- `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED`: TLS settings; keep certificate verification enabled
- `PRICE_MATCHER_SESSION_SECRET`: stable random value of at least 32 characters
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: PayPal **Sandbox** app credentials
- `PAYPAL_ENVIRONMENT`: must remain `sandbox`
- `CHANNEL3_API_KEY`: server-only product-data credential
- `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`: server-only AI configuration

Render requires PostgreSQL configuration and a stable session secret. Missing shared persistence makes health checks fail closed. PayPal remains Sandbox-only and is unchanged by the health-check fix.

The PostgreSQL health probe uses an approximately five-second connection timeout, four-second query/statement timeout, and a 4.8-second route deadline. Keep the Supabase Session pooler on port 5432, TLS enabled, and certificate validation enabled. See [Render health-check diagnosis](RENDER_HEALTHCHECK.md) for safe failure categories and manual checks.

## 4. Supabase

Create a dedicated PriceMatcher PostgreSQL/Supabase database only after approval. Apply both committed migrations in order before starting the service. Tables have RLS enabled without browser policies; the application connects through its server-only database role. Never reuse an unrelated database.

## 5. PayPal Sandbox

Create a Sandbox app in the PayPal Developer Dashboard. Add Sandbox credentials to Render only after the server-side create/capture implementation is reviewed. Do not use Live credentials. Run the documented manual payment test before enabling the button.

## 6. Channel3 and AI

Add credentials only after their adapters exist. External failures must fall back to an explicit fixture or a clear unavailable state, never an invented live result.

## 7. Verify

After deployment, confirm the deploy is healthy, open `/api/health`, and exercise storefront → cart → comparison → final amount on desktop and mobile. Payment success must only be tested after the PayPal phase.

## Troubleshooting

- Build failure: confirm Node 24 and run `npm ci && npm run build` locally.
- Health failure: confirm the start command uses the repository script and that Render supplies `PORT`.
- Blank integration data: check the relevant server-only variable name; never print secret values.
- Payment disabled: expected until both Sandbox credentials and the reviewed payment routes exist.
