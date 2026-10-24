import { createPriceProvider } from "../price-intelligence/channel3-provider";
import { PriceIntelligenceService } from "../price-intelligence/service";
import { getPersistence } from "./persistence";

const globalState = globalThis as typeof globalThis & { priceMatcherService?: PriceIntelligenceService };
export function getPriceIntelligenceService() {
  return globalState.priceMatcherService ??= new PriceIntelligenceService(
    createPriceProvider(),
    getPersistence().offers,
  );
}
