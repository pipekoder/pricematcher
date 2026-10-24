# PostgreSQL persistence and payment readiness

## Runtime selection

Local development defaults to `PERSISTENCE_BACKEND=local` and retains the checksummed file repository. A shared deployment must set `APP_ENV=production`, `PERSISTENCE_BACKEND=postgres`, and `DATABASE_URL`; configuration fails closed otherwise. The PostgreSQL pool is bounded by `DATABASE_POOL_MAX` and uses TLS unless explicitly disabled for a trusted local test database. No browser code receives database credentials.

Apply migrations in order before starting the service:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610240001_price_intelligence.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610240002_transactional_payment_readiness.sql
```

The health endpoint performs `SELECT 1`; it returns HTTP 503 without revealing connection details when persistence is unavailable.

## Transaction boundaries

Offer acceptance uses one transaction and `SELECT ... FOR UPDATE` on the offer, plus a lock on the latest merchant policy. It validates ownership, full-cart fingerprint, status, expiry and policy version before conditionally updating the offer and inserting the unique acceptance and append-only audit event. Revocation and consumption use the same row-lock pattern.

Checkout preparation locks the accepted offer, evaluates expiry with the database clock, and acquires the same merchant advisory lock used by policy writes before reading the latest policy. It rechecks the current-cart fingerprint and expected amount/currency inside that transaction, then creates or returns one checkout attempt. Database uniqueness on `offer_id` and `idempotency_key` prevents independent attempts during races. Provider order and transaction IDs are also unique. All state transitions lock the attempt row and append an audit event. A successful capture state can only follow the reviewed transition path; this PR never performs that transition through a provider.

## Trusted checkout preparation

`createApprovedCheckoutExecutor(...)` produces the requested `executeApprovedCheckout(offerId, approvalContext)` operation. The HTTP route authenticates the signed HttpOnly session and accepts an opaque offer ID plus current product IDs, variant keys and quantities. The executor rebuilds prices, shipping, tax and totals from the server catalog and compares the resulting full-cart fingerprint with the accepted snapshot. Browser or AI-generated prices, discounts and totals are never accepted. The response contains only the attempt ID, `prepared` status and whether it was newly created; the authoritative instruction and idempotency key stay server-side.

The provider-neutral `PaymentProvider` contract defines `createOrder`, `getOrder`, `captureOrder` and `verifyPayment`, normalized errors and idempotency. PayPal Agent Toolkit `create_order`, `get_order`, and `pay_order`, JavaScript SDK v6 buyer approval, and Orders API v2 fallback can be adapted later. No implementation or credentials are present, and the only allowed provider identifier is `paypal_sandbox`.

## Testing

Unit tests cover authorization, amount/cart/policy changes, duplicate and concurrent checkout preparation, transitions, idempotency and storage failures. PostgreSQL behavior is not considered fully verified until the opt-in suite completes. Create a disposable database, apply both migrations, and run:

```bash
TEST_DATABASE_URL="postgresql://..." npm run test:postgres
```

The suite exercises rollback, concurrent acceptance row locking and atomic checkout-attempt creation. It is skipped by the ordinary suite when `TEST_DATABASE_URL` is absent; no database is provisioned automatically.

## Remaining work

- Provision a dedicated PostgreSQL/Supabase database and apply migrations after approval.
- Run the opt-in integration suite against that database.
- Add an authenticated migration runner to the deployment workflow.
- Implement and review a Sandbox-only PayPal adapter and buyer-approval UI in a later PR.
- Define operational reconciliation jobs and retention policy before production use.
