# PayPal Agentic Checkout

Status: PayPal Sandbox implementation for PR #5. No Live access or real payment is supported.

## Supported versions and official interfaces

- `@paypal/agent-toolkit` is pinned to `1.11.0`, the current npm release and official repository HEAD reviewed on 25 October 2026 (`a3aa963`). PriceMatcher enables only `orders.create`, `orders.get`, and `orders.capture`, which expose `create_order`, `get_order`, and `pay_order`. Every toolkit instance sets `context.sandbox: true`.
- `@paypal/paypal-js` `11.3.0` uses its `sdk-v6` export. The browser loader explicitly sets `environment: "sandbox"`, creates an instance with the short-lived server-generated `clientToken`, checks PayPal eligibility, creates `createPayPalOneTimePaymentSession`, and calls the current `session.start(presentationOptions, Promise<{orderId}>)` interface. `onApprove` awaits the server capture-and-verification endpoint before setting success; `onCancel` never calls capture.
- The toolkit passes the durable checkout-attempt UUID as `PayPal-Request-Id` for create and capture. No LLM chooses a tool or supplies payment fields.

Official references:

- [PayPal Agent Toolkit](https://github.com/paypal/agent-toolkit)
- [PayPal JavaScript SDK loader and v6 types](https://github.com/paypal/paypal-js)
- [PayPal AI Agent Toolkit quickstart](https://docs.paypal.ai/developer/tools/ai/agent-toolkit-quickstart)
- [PayPal developer dashboard](https://developer.paypal.com/dashboard/applications/sandbox)

## Security boundary

The browser submits only the accepted offer ID, authoritative cart identifiers, and local checkout-attempt ID. It never submits an amount, currency, discount, PayPal order ID, capture ID, merchant policy, or session identity. Signed HttpOnly session ownership, offer freshness, cart totals, policy version, and persisted payment instructions are validated server-side.

The server adapter exposes the narrow `PaymentProvider` interface. Raw Toolkit tools and credentials are never sent to the browser or an AI model. `PAYPAL_ENVIRONMENT` fails closed unless it is `SANDBOX`. Client-token and payment responses use `no-store`; client secrets and OAuth access tokens remain server-only.

Atomic local states claim order creation (`order_pending`) and capture (`capture_pending`) before external calls. Retryable or ambiguous provider failures move to `reconciliation_required`. The durable checkout-attempt UUID is reused as the capture `PayPal-Request-Id` across retries.

Immediately after `pay_order` returns, the server durably records the capture transaction ID before completing local state. It then calls `get_order` independently and requires exactly one capture linked to the stored order. The order ID and status, capture ID and status, aggregate amount, capture amount, and both currencies must all match; missing or multiple captures fail closed.

If the process or database fails after PayPal captures, the next request inspects `get_order` before considering another `pay_order`. A completed exact capture is recorded and reconciled without another capture call. If a timed-out request still shows an approved, uncaptured order, the same durable request ID is used, allowing PayPal idempotency to return the original operation rather than create a second capture. Offer-consumption failures retain the order and capture identifiers in `reconciliation_required` until local recovery succeeds.

## Environment variables

```dotenv
PAYPAL_ENVIRONMENT=SANDBOX
PAYPAL_CLIENT_ID=<sandbox app client id>
PAYPAL_CLIENT_SECRET=<sandbox app secret>
PERSISTENCE_BACKEND=postgres
DATABASE_URL=<non-production PostgreSQL URL>
PRICE_MATCHER_SESSION_SECRET=<at least 32 random characters>
```

Create a REST app and buyer/seller test accounts in the PayPal **Sandbox** dashboard. Do not put credentials in `NEXT_PUBLIC_*`, source files, fixtures, logs, screenshots, or pull-request text. Apply migrations `202610240001`, `202610240002`, and `202610250003` in that order.

## Manual Sandbox test

1. Start the app with a disposable PostgreSQL database and Sandbox-only environment variables.
2. Add Nord Sound 2 to the cart and open checkout.
3. Click **Check Price**. Confirm the comparison is labeled fixture data and the eligible delivered price is $139 USD.
4. Click **Accept PriceMatcher offer**. Confirm no PayPal window opens automatically.
5. Click **Continue with PayPal Sandbox**. The server revalidates the offer/cart, prepares one attempt, creates one Sandbox order, and v6 opens buyer approval.
6. Sign in with a Sandbox buyer and approve. Confirm the UI reports success only after `get_order`, `pay_order`, and a final `get_order` verify `COMPLETED`, the exact USD amount, and a persisted transaction ID.
7. Repeat the capture request and confirm no second capture occurs. Cancel a fresh approval and confirm no capture call occurs. Inspect `checkout_attempts` for the PayPal order/capture IDs and append-only `transaction_audit_events` for `checkout.provider_capture_observed` plus the state sequence.

Automated tests mock every PayPal response. They do not establish that a real Sandbox payment completed. A credentialed manual Sandbox run remains required before claiming end-to-end provider validation.

## Known limitation

The Agent Toolkit order schema represents USD item prices as JavaScript numbers, although PriceMatcher keeps all authoritative calculations in integer minor units. The adapter creates one exact two-decimal USD line from the server total and verifies PayPal's decimal-string response back into minor units. Non-USD currencies remain unsupported for this hackathon flow.
