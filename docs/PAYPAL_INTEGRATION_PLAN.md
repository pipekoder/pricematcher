# PriceMatcher PayPal Agent Toolkit Integration Plan

Status: approved plan after the customer-controlled Agent Toolkit direction and PR #1 merge. This document is not authorization to implement PR #2 or PR #3.

## Sequencing

- PR #2 remains price intelligence and offer authorization. It adds no PayPal package or runtime operation.
- PR #3 adds the pinned `@paypal/agent-toolkit`, JS SDK v6, Sandbox checkout, and Orders API fallback.
- PayPal AI Toolkit is used for PR #3 development/review after installation approval.
- Sandbox MCP is used only for opt-in manual testing and troubleshooting.

## PR #2 prerequisites

PR #2 should establish:

1. A visible, accessible **Check Price** action. Discovery never starts on page load or without customer input.
2. A no-match/result path that transparently explains why no eligible discount exists.
3. An immutable USD `PriceMatchOffer` containing opaque ID, merchant, cart/session ownership, product/variant, original/adjusted amounts, shipping/fees/tax/total, policy version, evidence, issue/expiry, acceptance, and consumption state.
4. A server-only `validateCheckoutOffer(reference, context, clock)` use case.
5. An explicit customer acceptance event for adjusted or original price.
6. AI explanations generated only from an already completed deterministic decision.
7. A provider-neutral `PaymentProvider` interface, without PayPal implementation.
8. Tests for unsolicited-comparison prevention, tampering, expiry, ownership, changed cart/quantity, currency, replay, and no-eligible-offer behavior.

PR #2 must not install Agent Toolkit, load PayPal scripts, call Sandbox, create/capture orders, or display payment success.

## PR #3 modules

```text
payments/
  payment-provider.ts
  execute-approved-checkout.ts
  payment-state-machine.ts
  adapters/
    paypal-agent-toolkit.ts
    paypal-orders-api.ts
  repositories/
    checkout-orders.ts
    payment-transactions.ts
  paypal/
    config.ts
    normalize.ts
    errors.ts
```

Product intelligence, verification, policy, offer authorization, and transaction persistence remain separate.

## Restricted Agent Toolkit adapter

Pin the reviewed package version and configure only:

```ts
configuration: {
  context: { sandbox: true },
  actions: {
    orders: { create: true, get: true, capture: true }
  }
}
```

Verify the exact configuration keys against the installed version. Fail startup if Sandbox is not explicit. Do not enable invoices, subscriptions, refunds, disputes, catalog, shipment, reporting, or merchant insights.

Adapter methods:

```ts
interface PayPalAgentToolkitAdapter extends PaymentProvider {
  createOrder(input: ValidatedUsdOrder, idempotencyKey: string): Promise<ProviderOrder>;
  getOrder(orderId: string): Promise<ProviderOrder>;
  captureOrder(orderId: string, idempotencyKey: string): Promise<CaptureResult>;
}
```

Map these internally to `create_order`, `get_order`, and `pay_order`. Do not expose toolkit tools directly to the general AI model.

### Payload rules

- Currency is exactly `USD` for the demo.
- Amount comes from accepted server-side offer/original checkout.
- Use decimal-safe money conversion; never binary floating point as the authority.
- `itemCost`, `itemTotal`, quantity, tax, discount, shipping, and overall total must reconcile before invocation.
- Return/cancel URLs derive from validated application configuration.
- The local idempotency key and request identity must be durable. If the toolkit cannot set per-request `PayPal-Request-Id` safely, use the Orders API fallback for that operation.
- Verify the PayPal response total/currency before saving `AWAITING_BUYER_APPROVAL`.

## `executeApprovedCheckout`

```ts
executeApprovedCheckout(offerId, approvalContext)
```

The AI agent may request only this capability after a recorded customer action. The function does not accept raw payment values.

Before order creation it must:

1. authenticate session/customer;
2. load offer and cart;
3. verify customer initiated the comparison;
4. verify explicit offer/original-price acceptance;
5. verify merchant, product/variant, quantity, USD, policy version, expiry, and unused state;
6. recalculate amount and construct toolkit parameters;
7. atomically create/reuse the local checkout attempt;
8. call Agent Toolkit `create_order` once or return the stored result;
9. persist order ID, expected amount/currency, approval link/context, and audit event.

The AI cannot choose provider operation, amount, or capture timing.

## Buyer approval

Use PayPal JS SDK v6 in Sandbox:

- public client ID only;
- load v6 only, never v5 and v6 together;
- query eligible methods for `$139.00 USD` (or the actual validated total);
- start the one-time PayPal payment session with the server-created order;
- handle approval, cancellation, and error distinctly;
- never call `pay_order` on cancellation or creation alone.

Reconfirm current SDK signatures from live docs before implementation.

## Post-approval payment execution

On the approval callback:

1. Browser sends local checkout reference and the PayPal approval result—not amount.
2. Backend verifies ownership and linked PayPal order ID.
3. Adapter calls `get_order` and compares status, amount, USD currency, purchase units, and merchant/payee when available to stored expectations.
4. Backend requires an approval-compatible state and atomically claims capture.
5. Adapter calls `pay_order` with the stored order ID.
6. Normalize the actual response and use `get_order` for reconciliation where needed.
7. Mark success only for a verified completed capture; store capture ID/status and consume the offer.
8. Duplicate requests return the stored result or reconcile, never recapture blindly.

Use direct Orders API v2 for an operation when Agent Toolkit cannot provide required headers, schemas, fields, status detail, idempotency, or error handling. Record which adapter performed each operation.

## State transitions

Allowed transitions:

- `OFFER_ACCEPTED -> ORDER_CREATING`
- `ORDER_CREATING -> AWAITING_BUYER_APPROVAL | ORDER_FAILED`
- `AWAITING_BUYER_APPROVAL -> BUYER_APPROVED | BUYER_CANCELLED`
- `BUYER_APPROVED -> CAPTURE_IN_PROGRESS`
- `CAPTURE_IN_PROGRESS -> CAPTURED | CAPTURE_FAILED | RECONCILIATION_REQUIRED`

Every transition checks expected prior state and writes an audit event. Expiry and cancellation never transition to capture.

## Sandbox tests

### Automated with mocked adapters

- comparison starts only after **Check Price**;
- normal checkout remains available without comparison;
- eligible `$149 -> $139` path and no-discount path;
- agent cannot call checkout before recorded acceptance;
- toolkit payload exactly matches server-authorized USD values;
- expired, changed, wrong-owner, wrong-merchant, wrong-product, and replayed offers fail;
- create-order idempotency;
- creation does not appear as payment success;
- buyer cancellation never calls `pay_order`;
- `get_order` mismatch in status/amount/currency/merchant blocks capture;
- capture success, decline/failure, timeout, duplicate, and uncertain response;
- Orders API fallback selection for unsupported toolkit behavior;
- logs redact client secret, access token, and payer data.

### Manual Sandbox demonstration

1. Customer sees fictional `$149` product and selects **Check Price**.
2. Comparison returns merchant-authorized `$139` offer.
3. Customer selects **Accept Price Match**.
4. Confirm Agent Toolkit creates exactly `$139 USD` and returns a real Sandbox order ID.
5. Customer approves in PayPal's supported UI.
6. Confirm `get_order` verification and `pay_order` capture.
7. Confirm actual completed result, stored transaction, and dashboard entry.
8. Repeat customer cancellation, expired offer, duplicate execution, failure, and no-discount scenario.
9. Optionally inspect the order via Sandbox MCP as independent developer evidence.

Do not simulate toolkit operations as genuine transactions, use Live access, or move real money.

## Risks and dependencies

- PR #1 must be approved/merged before dependent work.
- PR #2 offer authorization must exist before PR #3.
- Sandbox credentials and test accounts require explicit approval/setup.
- Current toolkit order schema is USD-only; production currencies need toolkit support or Orders API fallback.
- `pay_order` naming obscures that it captures; enforce internal method name `captureOrder`.
- Toolkit sample workflows allow model-generated payloads; do not use them.
- Confirm per-request idempotency/header support; fall back when insufficient.
- Durable database state is required for ownership, replay protection, and capture idempotency. Resolve the PR #3/PR #4 persistence dependency before payment implementation.
- Live PayPal and Devpost docs must be rechecked outside this environment's blocked egress.

## Acceptance criteria

- customer alone initiates comparison;
- visible **Check Price** and original-price checkout paths;
- real Agent Toolkit Sandbox `create_order`, `get_order`, and `pay_order` where supported;
- trusted backend exclusively controls payment parameters;
- explicit PriceMatcher acceptance and PayPal buyer approval;
- amount/currency/merchant/state verified before capture;
- actual verified transaction controls success UI;
- durable idempotency, replay protection, and audit trail;
- success, no-discount, failure, cancellation, expiry, mismatch, and duplicate tests;
- Orders API fallback documented and tested;
- no Live access, real payment, exposed credential, deployment, or unrelated infrastructure.

## Official sources

- [PayPal AI Toolkit](https://github.com/paypal/AI-Toolkit), commit `1401791`
- [PayPal Agent Toolkit](https://github.com/paypal/agent-toolkit), v1.11.0, commit `a3aa963`
- [Agent Toolkit quickstart](https://docs.paypal.ai/developer/tools/ai/agent-toolkit-quickstart)
- [MCP quickstart](https://docs.paypal.ai/developer/tools/ai/mcp-quickstart)
- [Agent tools reference](https://docs.paypal.ai/developer/tools/ai/agent-tools-ref)
- [Orders API v2](https://developer.paypal.com/docs/api/orders/v2/)
