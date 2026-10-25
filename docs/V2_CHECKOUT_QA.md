# V2 checkout QA

Official package reference: <https://github.com/paypal/paypal-js> (`@paypal/paypal-js` v11.3.0, SDK v6 export). Public PayPal documentation could not be fetched from the development environment because its outbound proxy returned HTTP 403, so no live-provider claim is made.

## Deployment configuration

Apply the existing migrations in order. This change stores its cart-wide line decisions inside the existing immutable offer `record`, so it introduces no schema migration.

For demo mode set `PRICE_DISCOVERY_MODE=fixture`. For live candidate discovery set `PRICE_DISCOVERY_MODE=channel3` and configure the server-only Channel3 variables documented in `CHANNEL3_V2.md`. Never expose either provider's credentials with a `NEXT_PUBLIC_` prefix.

PayPal remains Sandbox-only. Configure `PAYPAL_ENVIRONMENT=SANDBOX`, the Sandbox client ID and secret, and retain the documented PostgreSQL/TLS configuration.

## Manual flow

1. Add Nord Sound 2 and at least one other product to the cart.
2. Open checkout and confirm the original total is visible.
3. Select **Check prices with AI**. Verify one result card appears for every distinct cart line.
4. In fixture mode, verify the demo-data banner is visible and only the exact Nord Sound 2 fixture can produce a discount.
5. Accept the consolidated offer. Verify the summary total equals the server-authorized total.
6. Change a quantity. Verify the accepted authorization and PayPal action are invalidated, including after changing A → B → A.
7. Let an offer expire and verify payment is disabled with a fresh-comparison action.
8. Reload and confirm no accepted discount is restored from browser state.
9. Without running comparison, select **Continue at original price** and verify a server-authorized zero-discount total enables Sandbox checkout.
10. With mocked provider calls, verify cancellation, retry, duplicate capture and reconciliation behavior.

Do not perform a real Sandbox transaction without explicit approval. A mocked success is not evidence of a live Sandbox payment.

## PayPal token diagnosis

The installed official `@paypal/paypal-js` 11.3.0 v6 README and TypeScript union allow `createInstance` to use either a public `clientId` or a `clientToken`. PriceMatcher loads only `paypal-payments`, so the browser now receives only the Sandbox client ID and no longer makes the unnecessary identity client-token request that produced the deployed error. Server-side order and capture operations still authenticate independently and retain credentials on the server.

The retained token helper logs only stage (`oauth` or `client_token`), HTTP status, safe category and elapsed time for any future component that genuinely requires a client token. It never logs authorization headers or token/provider bodies. Because no credentials or external transaction calls were authorized during development, PayPal remains **IMPLEMENTED BUT NOT CREDENTIAL-TESTED**.
