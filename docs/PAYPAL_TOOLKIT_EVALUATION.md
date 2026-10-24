# PayPal Toolkit Evaluation for PriceMatcher

Status: revised pre-PR #2 review, 24 October 2026. No plugin, package, MCP server, token, or credential was installed or configured. The implementation direction is to use Agent Toolkit actively for the USD hackathon transaction flow.

## AI Toolkit Codex plugin

The official repository provides these Codex commands:

```text
codex plugin marketplace add paypal/AI-Toolkit
codex plugin add paypal@paypal-ai-toolkit
```

The review environment runs `codex-cli 0.163.0` and supports both `codex plugin marketplace add` and `codex plugin add`; the mechanism is compatible. The repository contains `.agents/plugins/marketplace.json`, `.codex-plugin/plugin.json` v1.2.0, PayPal best-practice/routing skills, an SSE MCP declaration, and pre-write review hooks. Commands are documented mainly for Claude/Cursor; Codex uses the skills and MCP via natural language.

The session's plugin directory search did not return a packaged PayPal plugin. Installation should therefore use the official Codex marketplace commands after approval. No installation was attempted.

## Development skills and reliability value

The best-practices skill covers Orders, JS SDK v6/v5 routing, OAuth and idempotency, webhooks, Sandbox tests, subscriptions, invoices, disputes/refunds, shipment, payouts, 3-D Secure, agentic commerce, and MCP tools.

Its checklist requires server-side order creation, webhook verification, `PayPal-Request-Id`, `INSTRUMENT_DECLINED` handling, 429 backoff, `debug_id` logging, credential isolation, and avoiding legacy APIs. This should improve PR #3 generation/review consistency, but does not replace live docs, automated tests, or human security review.

## Sandbox MCP configuration

The official plugin declares:

```json
{
  "type": "sse",
  "url": "https://mcp.sandbox.paypal.com/sse",
  "headers": { "Authorization": "Bearer ${PAYPAL_SANDBOX_ACCESS_TOKEN}" }
}
```

Setup requires a PayPal Developer Sandbox app and a short-lived Sandbox access token placed in Codex configuration, then a full restart. The repository states that tokens expire in up to eight hours. Never commit, echo, log, or expose this token to the browser. No token was created or requested in this review.

The plugin advertises Sandbox tools for orders/payments, invoices, subscriptions, disputes, catalog, shipment, and reporting. Feature-flagged commerce tools (`search_product`, `create_cart`, `checkout_cart`) are not assumed available.

## Capability matrix

| Capability | AI skill | Sandbox MCP | Agent Toolkit 1.11.0 | Orders API + JS SDK v6 | Decision |
|---|---:|---:|---:|---:|---|
| Architecture/code guidance | Yes | No | No | Docs | Use skill in development |
| Create order | Guidance | Advertised | Yes; current schema USD-only | Yes | Agent Toolkit primary for USD demo; Orders API fallback |
| Retrieve order | Guidance | Advertised | Yes | Yes | API authoritative; optional read-only assistant |
| Buyer approval | Guidance | No | No | Yes | JS SDK v6 only |
| Capture approved order | Guidance | Advertised | `pay_order` | Yes | Agent Toolkit primary after verified approval; API fallback |
| Verify transaction | Guidance | Inspection aid | `get_order` | API/webhooks | Direct API plus verified webhook |
| Refund | Guidance | Advertised | Yes | Payments API | Exclude from MVP agent tools |
| List transactions | Guidance | Advertised | Yes | Reporting API | Optional read-only assistant after test |
| Merchant insights | Guidance | Advertised | Source rejects Sandbox | Reporting | Exclude from Sandbox demo |
| Competitor intelligence | No | No | No | No | PriceMatcher/Channel3 |
| Decide final amount | Warns against it | Tool input | Tool input | Server input | Deterministic PriceMatcher only |
| Bypass buyer approval | No | No | No | No | Unsupported/prohibited |

## Agent Toolkit workflow assessment

| Step | Toolkit support | Recommendation |
|---|---|---|
| Receive merchant-approved offer | No PriceMatcher model | Internal offer service |
| Validate offer reference | No | Deterministic PriceMatcher server checks |
| Create Sandbox order | `create_order`; current TS schema is USD-only | Use for USD demo, but construct parameters exclusively from trusted backend records |
| Obtain customer approval | No | JS SDK v6 buyer interaction |
| Capture | `pay_order` maps to capture | Use only behind `executeApprovedCheckout` after approval verification; never expose raw capture tool to model |
| Return verified result | `get_order` | Direct API plus webhook/reconciliation; AI may explain only |
| Record outcome | No application persistence | PriceMatcher repositories and audit log |

An agent cannot and must not bypass buyer approval. Order creation does not mean approval; approval does not mean capture success.

## MCP usage boundary

Good developer-time uses:

- inspect Sandbox order details and status;
- compare state before/after buyer approval and capture;
- reproduce/troubleshoot API errors;
- run manual create/capture tests with a dedicated Sandbox account;
- inspect recent transactions when the connected tool supports it;
- independently confirm results created by the application.

Do not use MCP as a browser endpoint, production backend dependency, unrestricted model tool set, price/offer authority, buyer-approval bypass, or credential store. Automated tests should mock `PaymentProvider`; MCP is opt-in manual-test evidence.

## Risks

1. Version drift: pin reviewed versions and recheck before PR #3.
2. Conflicting defaults: Agent Toolkit source defaults Sandbox to false while README language says Sandbox default. Always set `context.sandbox: true` and hard-fail on mismatch.
3. Currency: current TypeScript `create_order` permits USD only. This supports the revised hackathon demo, but production currency expansion requires toolkit changes or the Orders API fallback.
4. Naming: `pay_order` actually captures and is a high-risk write.
5. Model authority: sample workflows generate order objects with an LLM; PriceMatcher must not.
6. Credential lifecycle: MCP uses an expiring bearer token; runtime Orders uses server-managed OAuth.
7. Remote/local mismatch: inspect actual remote schemas after an approved connection.
8. Live docs and Devpost pages were unavailable under this environment's egress policy; reconfirm them manually.

## Active integration decision

The USD demonstration removes the prior currency blocker. Recommend:

1. Install the official AI Toolkit for PR #3 development only after approval.
2. Add a pinned `@paypal/agent-toolkit` version in PR #3, not PR #2.
3. Configure only `orders.create`, `orders.get`, and `orders.capture`, with `context.sandbox: true` explicit.
4. Wrap the toolkit in a server-only adapter. The AI agent receives only `executeApprovedCheckout(offerId, approvalContext)`; it never receives raw PayPal tools or financial fields.
5. Construct `create_order` inputs from the validated offer/cart. Do not use the sample `generateOrder` workflow that asks an LLM to build order details.
6. Use JS SDK v6 for buyer approval between `create_order` and `pay_order`.
7. Use `get_order` before capture and again for reconciliation/verification as necessary.
8. Maintain an Orders API v2 adapter for unsupported fields, toolkit defects, or response gaps.

This is feasible with the reviewed toolkit, subject to live Sandbox confirmation. It preserves Agent Toolkit as an active execution component without granting AI authority over price, approval, or capture eligibility.

## Official sources

- [PayPal AI Toolkit](https://github.com/paypal/AI-Toolkit), v1.2.0, commit `1401791`
- [PayPal Agent Toolkit](https://github.com/paypal/agent-toolkit), v1.11.0, commit `a3aa963`
- [PayPal AI tools](https://docs.paypal.ai/developer/tools/ai/)
- [Agent Toolkit quickstart](https://docs.paypal.ai/developer/tools/ai/agent-toolkit-quickstart)
- [MCP quickstart](https://docs.paypal.ai/developer/tools/ai/mcp-quickstart)
- [Agent tools reference](https://docs.paypal.ai/developer/tools/ai/agent-tools-ref)
