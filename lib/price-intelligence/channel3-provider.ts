import { Channel3 } from "@channel3/sdk";
import type { Product } from "../types";
import { FixturePriceProvider } from "./fixture-provider";
import { decimalToMinor, unknownDeliveredCostResolver, type DeliveredCostResolver, type DiscoveredOffer, type PriceIntelligenceProvider } from "./provider";

export class Channel3PriceProvider implements PriceIntelligenceProvider {
  readonly sourceType = "live" as const;
  private readonly client: Channel3;
  constructor(apiKey: string, private readonly now = () => new Date(), private readonly deliveredCosts: DeliveredCostResolver = unknownDeliveredCostResolver) {
    if (!apiKey) throw new Error("CHANNEL3_API_KEY is required in live mode");
    this.client = new Channel3({ apiKey });
  }
  async search(product: Product): Promise<DiscoveredOffer[]> {
    const page = await this.client.products.search({
      query: `${product.brand} ${product.model} ${product.gtin} ${product.variant.color}`,
      limit: 10, config: { country: "US", currency: "USD" },
    });
    const normalized: DiscoveredOffer[] = [];
    for (const candidate of page.data) for (const offer of candidate.offers ?? []) {
      const price = decimalToMinor(offer.price.price, "USD");
      let domain: string;
      try { domain = new URL(offer.url).hostname.toLowerCase().replace(/^www\./, ""); } catch { continue; }
      if (!price) continue;
      const quote = await this.deliveredCosts.resolve({ sourceUrl: offer.url, productPrice: price });
      const validQuote = quote && quote.shipping.currency === "USD" && quote.mandatoryFees.currency === "USD" && quote.shipping.amountMinor >= 0 && quote.mandatoryFees.amountMinor >= 0 ? quote : null;
      normalized.push({
        providerProductId: candidate.id, retailer: offer.domain || domain, retailerDomain: domain,
        sourceUrl: offer.url, sourceType: "live" as const, retrievedAt: this.now().toISOString(),
        productTitle: candidate.title, brand: candidate.brands?.[0]?.name,
        productPrice: price, shipping: validQuote?.shipping ?? null, fees: validQuote?.mandatoryFees ?? null,
        deliveredCostSource: validQuote?.method ?? "unknown", deliveredCostRetrievedAt: validQuote?.obtainedAt,
        availability: offer.availability === "InStock" ? "in_stock" as const : offer.availability === "OutOfStock" ? "out_of_stock" as const : "unknown" as const,
        condition: offer.condition === "used" ? "used" as const : offer.condition === "new" ? "new" as const : undefined,
      });
    }
    return normalized;
  }
}

export function createPriceProvider() {
  const mode = process.env.PRICE_DISCOVERY_MODE ?? "fixture";
  if (mode === "fixture") return new FixturePriceProvider();
  if (mode === "live") return new Channel3PriceProvider(process.env.CHANNEL3_API_KEY ?? "");
  throw new Error("PRICE_DISCOVERY_MODE must be fixture or live");
}
