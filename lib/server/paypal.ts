import { createPayPalCheckoutService } from "../payments/paypal-checkout";
import { createPayPalSandboxProvider } from "../payments/paypal-agent-toolkit";
import { getPersistence } from "./persistence";

export function getPayPalCheckoutService() {
  const persistence = getPersistence();
  return createPayPalCheckoutService({ offers: persistence.offers, transactions: persistence.transactions, provider: createPayPalSandboxProvider() });
}
