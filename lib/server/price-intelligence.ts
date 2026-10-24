import { join } from "node:path";
import { FilePriceIntelligenceRepository } from "../persistence/file-repository";
import { createPriceProvider } from "../price-intelligence/channel3-provider";
import { PriceIntelligenceService } from "../price-intelligence/service";

const globalState = globalThis as typeof globalThis & { priceMatcherService?: PriceIntelligenceService };
export function getPriceIntelligenceService() {
  return globalState.priceMatcherService ??= new PriceIntelligenceService(
    createPriceProvider(),
    new FilePriceIntelligenceRepository(process.env.PRICE_MATCHER_DATA_FILE ?? join(process.cwd(), ".data", "price-intelligence.json")),
  );
}
