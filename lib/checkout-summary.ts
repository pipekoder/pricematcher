import { addMoney, subtractMoney } from "./money";
import type { Money } from "./types";

export type AcceptedOfferSummary = {
  offerId: string;
  originalSubtotal: Money;
  shipping: Money;
  tax: Money;
  fees: Money;
  originalTotal: Money;
  savings: Money;
  totalToPay: Money;
  expiresAt: string;
};

export function acceptedOfferSummary(input: Omit<AcceptedOfferSummary, "originalTotal" | "savings">): AcceptedOfferSummary {
  const originalTotal = addMoney(input.originalSubtotal, input.shipping, input.tax, input.fees);
  const savings = subtractMoney(originalTotal, input.totalToPay);
  if (savings.amountMinor < 0) throw new Error("Authorized total exceeds the original total");
  return { ...input, originalTotal, savings };
}

export const invalidatesAuthorizedOffer = (code?: string) => [
  "expired", "stale_evidence", "cart_changed", "policy_changed", "product_changed",
  "pricing_changed", "amount_changed", "totals_changed", "offer_invalid", "offer_not_accepted",
].includes(code ?? "");
