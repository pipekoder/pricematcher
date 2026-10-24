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
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: browser-safe Supabase config (future phase)
- `SUPABASE_SERVICE_ROLE_KEY`: server-only; never prefix with `NEXT_PUBLIC_`
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: PayPal **Sandbox** app credentials
- `PAYPAL_ENVIRONMENT`: must remain `sandbox`
- `CHANNEL3_API_KEY`: server-only product-data credential
- `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`: server-only AI configuration

Foundation needs only `NEXT_PUBLIC_APP_URL`, `APP_ENV`, and `PAYPAL_ENVIRONMENT`. Optional missing integrations retain the labeled fixture experience. Payment remains disabled when PayPal credentials are absent.

## 4. Supabase

Create a dedicated PriceMatcher project in the persistence phase. Apply committed migrations, enable row-level security, and put the service-role secret only in Render's environment. Never reuse an unrelated database.

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
