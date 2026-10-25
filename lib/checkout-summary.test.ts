import { describe, expect, it } from "vitest";
import { acceptedOfferSummary, invalidatesAuthorizedOffer } from "./checkout-summary";

const usd = (amountMinor: number) => ({ amountMinor, currency: "USD" as const });

describe("authorized checkout summary", () => {
  it("derives original total and savings using integer minor units", () => {
    expect(acceptedOfferSummary({ offerId: "offer", originalSubtotal: usd(49010), shipping: usd(590), tax: usd(0), fees: usd(0), totalToPay: usd(47600), expiresAt: "2026-10-25T12:00:00Z" })).toMatchObject({ originalTotal: usd(49600), savings: usd(2000), totalToPay: usd(47600) });
  });

  it("rejects an inconsistent payable total", () => {
    expect(() => acceptedOfferSummary({ offerId: "offer", originalSubtotal: usd(14900), shipping: usd(0), tax: usd(0), fees: usd(0), totalToPay: usd(15000), expiresAt: "2026-10-25T12:00:00Z" })).toThrow();
  });

  it("invalidates discounts for stale, expired, cart, policy and amount failures only", () => {
    for (const code of ["expired", "stale_evidence", "cart_changed", "policy_changed", "amount_changed"]) expect(invalidatesAuthorizedOffer(code)).toBe(true);
    expect(invalidatesAuthorizedOffer("paypal_oauth_failed")).toBe(false);
  });
});
