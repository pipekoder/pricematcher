# PriceMatcher PayPal AI Architecture

Status: approved architecture direction, 24 October 2026, prepared after PR #1 merged. No package, plugin, token, or credential was installed as part of this documentation change.

## Product boundary

PriceMatcher is a customer-controlled price matching assistant. It never initiates a comparison, negotiates, or displays a discount before the customer selects **Check Price**. A normal purchase at the original price remains available without PriceMatcher.

```text
Customer selects Check Price
 -> AI-assisted price discovery and interpretation
 -> deterministic product/seller verification
 -> deterministic merchant pricing policy
 -> merchant-authorized, time-limited USD offer
 -> customer accepts offer or keeps original price
 -> controlled PayPal Agent Toolkit order creation
 -> PayPal-hosted buyer approval
 -> controlled Agent Toolkit capture
 -> independent order/capture verification
 -> recorded transaction and audit event
```

## Architecture decision

For the USD hackathon demonstration, make `@paypal/agent-toolkit` an active server-side payment adapter for its confirmed operations:

- `create_order`: create the exact backend-authorized USD Sandbox order;
- `get_order`: retrieve and verify order state, amount, currency, and available merchant/payee identity;
- `pay_order`: capture an order after PayPal buyer approval.

Keep an Orders API v2 adapter behind the same interface for any unsupported operation or toolkit limitation. JS SDK v6 remains the buyer-approval surface because Agent Toolkit does not perform buyer approval.

No general model receives `create_order`, `get_order`, or `pay_order` directly. The agent sees only a narrow PriceMatcher capability:

```ts
executeApprovedCheckout(offerId, approvalContext)
```

This function accepts no amount, currency, line items, merchant, or PayPal order ID from model text. Its trusted backend loads and validates them.

## Confirmed toolkit feasibility

Reviewed from official `paypal/agent-toolkit` TypeScript v1.11.0 at commit `a3aa963`:

| Operation | Confirmed behavior | PriceMatcher use |
|---|---|---|
| `create_order` | Calls `POST /v2/checkout/orders`; schema currently allows USD only; creates `CAPTURE` intent and returns PayPal response/approval links | Supported for the USD demo after trusted payload construction |
| `get_order` | Calls `GET /v2/checkout/orders/{id}` | Verify linked order, amount, currency, status, and payee data when returned |
| `pay_order` | Calls `POST /v2/checkout/orders/{id}/capture` | Use only after buyer approval and local state validation |

Important schema details:

- `create_order` expects `currencyCode: "USD"`, up to 50 items, `discount`, `shippingCost`, optional address/notes, and return/cancel URLs.
- Each item includes `name`, integer `quantity`, `itemCost`, `itemTotal`, and `taxPercent`.
- Current payload construction calculates totals from `itemCost`, quantity, tax, shipping, and discount; the adapter must construct these fields consistently and verify returned totals.
- `get_order` and `pay_order` accept a PayPal order ID.
- `pay_order` is capture; its name must not be interpreted as buyer approval.
- `context.sandbox: true` must be explicit. Source defaults to production if omitted, despite README language suggesting Sandbox default.

## Controlled execution state machine

Recommended local states:

```text
OFFER_ISSUED
 -> OFFER_ACCEPTED
 -> ORDER_CREATING
 -> AWAITING_BUYER_APPROVAL
 -> BUYER_APPROVED
 -> CAPTURE_IN_PROGRESS
 -> CAPTURED
```

Terminal/side states: `OFFER_EXPIRED`, `ORDER_FAILED`, `BUYER_CANCELLED`, `CAPTURE_FAILED`, and `RECONCILIATION_REQUIRED`.

Transitions are server-controlled and auditable. An agent request never moves state by itself.

### `executeApprovedCheckout(offerId, approvalContext)`

Before `create_order`, the backend must:

1. authenticate the customer/session;
2. load the cart and offer by opaque ID;
3. verify ownership, merchant, product, variant, quantity, USD currency, policy version, acceptance, expiry, and unused state;
4. recalculate the final amount from authoritative records;
5. atomically claim an idempotent checkout attempt;
6. construct the toolkit payload without model-provided financial fields;
7. call only the allowlisted Agent Toolkit adapter operation;
8. persist the PayPal order ID, expected total/currency, response state, and safe audit metadata.

The function returns an order reference for the JS SDK v6 approval session. It does not capture at creation time.

### Buyer approval and capture

1. JS SDK v6 presents PayPal's supported Sandbox approval UI.
2. Cancellation produces `BUYER_CANCELLED`; it never calls capture.
3. On approval, the browser sends only the local checkout reference and PayPal approval context.
4. The backend reloads the linked order through `get_order`, checks expected ID, amount, USD currency, merchant/payee when available, and an approval-compatible status.
5. The backend atomically claims capture and calls `pay_order` with the stored PayPal order ID.
6. The backend uses `get_order` again when necessary to verify the final transaction/capture result.
7. Only a confirmed completed capture produces success and consumes the offer.

If the toolkit cannot express a required create/get/capture parameter or response safely, the Orders API adapter performs that operation without changing the workflow or security boundary.

## Separation of concerns

| Module | Responsibility |
|---|---|
| Product intelligence | Candidate retrieval and AI-assisted interpretation after customer request |
| Verification | Exact product/variant, seller authenticity, availability, freshness |
| Pricing policy | Deterministic eligibility, floor, discount cap, and USD final price |
| Offer authorization | Immutable offer snapshot, ownership, acceptance, expiry, consumption |
| Agent orchestration | Request the narrow `executeApprovedCheckout` capability after customer acceptance |
| Agent Toolkit adapter | Allowlisted create/get/pay operations and normalized responses |
| Orders API adapter | Compatible fallback for unsupported toolkit behavior |
| Payment records | Local order/capture state, idempotency, reconciliation, audit |

Both payment adapters implement a provider-neutral interface so non-PayPal providers remain commercially possible:

```ts
interface PaymentProvider {
  createOrder(input: ValidatedPaymentOrder, idempotencyKey: string): Promise<ProviderOrder>;
  getOrder(providerOrderId: string): Promise<ProviderOrder>;
  captureOrder(providerOrderId: string, idempotencyKey: string): Promise<CaptureResult>;
}
```

## AI and security boundaries

- Comparison begins only after an explicit **Check Price** action.
- AI may interpret products/offers and explain a deterministic decision; it cannot authorize price or payment.
- The model never supplies amount, currency, merchant, line items, discount, PayPal order ID, or capture state.
- Sandbox client secret, OAuth token, and MCP token remain server/developer-side and never enter prompts or browser responses.
- Configure only `orders.create`, `orders.get`, and `orders.capture`; disable every other Agent Toolkit action.
- Require Sandbox configuration in code and fail closed on missing/Live configuration.
- Use stable idempotency/replay keys, durable locks, ownership checks, and append-only audit events.
- Never treat order creation or buyer approval as payment success.
- Record PayPal resource IDs and safe error `debug_id`; redact credentials and payer-sensitive data.
- Verify webhooks if used and process them idempotently.

## Expected demonstration

1. Product price: `$149.00`.
2. Customer selects **Check Price**.
3. AI-assisted discovery evaluates candidates only after that action.
4. Verification and policy authorize `$139.00`.
5. Customer explicitly selects **Accept Price Match**.
6. Backend validates the offer and Agent Toolkit creates exactly `$139.00 USD` in Sandbox.
7. Customer approves through PayPal.
8. Backend verifies with `get_order`; Agent Toolkit `pay_order` captures.
9. Backend verifies and records the actual result.

A second path shows the customer-requested comparison returning no eligible discount and allows checkout at `$149.00`.

## Confirmed versus pending

Confirmed from official repositories: tool names, current USD schema, create/get/capture endpoint mappings, action allowlists, explicit Sandbox context, Codex plugin manifests, and Sandbox MCP definition.

Reconfirm against live documentation before PR #3: exact JS SDK v6 signatures, actual remote MCP schemas, order status requirements before capture, merchant/payee fields returned for the configured account, webhook events, and current hackathon requirements. Live PayPal/Devpost domains were blocked by this review environment, so web-only details are not presented as confirmed.

## Official sources

- [PayPal AI Toolkit](https://github.com/paypal/AI-Toolkit), commit `1401791`
- [PayPal Agent Toolkit](https://github.com/paypal/agent-toolkit), v1.11.0, commit `a3aa963`
- [PayPal AI documentation](https://docs.paypal.ai/developer/tools/ai/)
- [Agent Toolkit quickstart](https://docs.paypal.ai/developer/tools/ai/agent-toolkit-quickstart)
- [MCP quickstart](https://docs.paypal.ai/developer/tools/ai/mcp-quickstart)
- [Agent tools reference](https://docs.paypal.ai/developer/tools/ai/agent-tools-ref)
- [Orders API v2](https://developer.paypal.com/docs/api/orders/v2/)
