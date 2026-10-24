import { Channel3 } from "@channel3/sdk";
import type { Product } from "../types";
import { FixturePriceProvider } from "./fixture-provider";
import { decimalToMinor, type DiscoveredOffer, type PriceIntelligenceProvider } from "./provider";

export class Channel3PriceProvider implements PriceIntelligenceProvider {
  readonly sourceType = "live" as const;
  private readonly client: Channel3;
  constructor(apiKey: string, private readonly now = () => new Date()) {
    if (!apiKey) throw new Error("CHANNEL3_API_KEY is required in live mode");
    this.client = new Channel3({ apiKey });
  }
  async search(product: Product): Promise<DiscoveredOffer[]> {
    const page = await this.client.products.search({
      query: `${product.brand} ${product.model} ${product.gtin} ${product.variant.color}`,
      limit: 10, config: { country: "US", currency: "USD" },
    });
    return page.data.flatMap((candidate) => (candidate.offers ?? []).flatMap((offer) => {
      const price = decimalToMinor(offer.price.price, "USD");
      let domain: string;
      try { domain = new URL(offer.url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return []; }
      if (!price) return [];
      return [{
        providerProductId: candidate.id, retailer: offer.domain || domain, retailerDomain: domain,
        sourceUrl: offer.url, sourceType: "live" as const, retrievedAt: this.now().toISOString(),
        productTitle: candidate.title, brand: candidate.brands?.[0]?.name,
        productPrice: price, shipping: null, fees: null,
        availability: offer.availability === "InStock" ? "in_stock" as const : offer.availability === "OutOfStock" ? "out_of_stock" as const : "unknown" as const,
        condition: offer.condition === "used" ? "used" as const : offer.condition === "new" ? "new" as const : undefined,
      }];
    }));
  }
}

export function createPriceProvider() {
  const mode = process.env.PRICE_DISCOVERY_MODE ?? "fixture";
  if (mode === "fixture") return new FixturePriceProvider();
  if (mode === "live") return new Channel3PriceProvider(process.env.CHANNEL3_API_KEY ?? "");
  throw new Error("PRICE_DISCOVERY_MODE must be fixture or live");
}
