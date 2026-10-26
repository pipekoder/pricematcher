import { Channel3, type Channel3Api } from "@channel3/sdk";
import type { Product } from "../types";
import { FixturePriceProvider } from "./fixture-provider";
import { decimalToMinor, unknownDeliveredCostResolver, type DeliveredCostResolver, type DiscoveredOffer, type PriceIntelligenceProvider } from "./provider";

export class Channel3PriceProvider implements PriceIntelligenceProvider {
  readonly sourceType = "live" as const;
  private readonly cache=new Map<string,{expires:number;value:DiscoveredOffer[]}>();private requests:number[]=[];
  private readonly client:{products:{search:(request:Channel3Api.SearchRequest,options?:{timeoutInSeconds?:number;maxRetries?:number})=>Promise<{data:Channel3Api.Product[]}>}};
  constructor(apiKey: string, private readonly now = () => new Date(), private readonly deliveredCosts: DeliveredCostResolver = unknownDeliveredCostResolver,client?:Channel3PriceProvider["client"],private readonly timeoutSeconds=8,private readonly requestBudget=Math.min(6, Number(process.env.CHANNEL3_REQUEST_BUDGET ?? 6))) {
    if (!apiKey) throw new Error("CHANNEL3_API_KEY is required in live mode");
    if (!Number.isSafeInteger(this.requestBudget) || this.requestBudget < 1) throw new Error("CHANNEL3_REQUEST_BUDGET must be an integer from 1 to 6");
    this.client = client??new Channel3({ apiKey });
  }
  async search(product: Product): Promise<DiscoveredOffer[]> {
    const key=`${product.id}:${product.gtin}:${product.variant.color}:${product.variant.size??""}`;const cached=this.cache.get(key);if(cached&&cached.expires>this.now().getTime())return structuredClone(cached.value);
    const cutoff=this.now().getTime()-60_000;this.requests=this.requests.filter((time)=>time>cutoff);if(this.requests.length>=this.requestBudget)throw new Error("CHANNEL3_RATE_LIMIT: Local Channel3 request budget exhausted");this.requests.push(this.now().getTime());
    const page = await this.client.products.search({
      query: `${product.brand} ${product.model} ${product.gtin} ${product.variant.color}`,
      limit: 5, config: { country: "US", currency: "USD",mode:"default",offer_refresh_timeout_ms:3000 },
    },{timeoutInSeconds:this.timeoutSeconds,maxRetries:0});
    const normalized: DiscoveredOffer[] = [];
    for (const candidate of page.data) for (const offer of candidate.offers ?? []) {
      const price = decimalToMinor(offer.price.price, "USD");
      let domain: string;
      try { domain = new URL(offer.url).hostname.toLowerCase().replace(/^www\./, ""); } catch { continue; }
      if (!price) continue;
      const quote = await this.deliveredCosts.resolve({ sourceUrl: offer.url, productPrice: price });
      const validQuote = quote && quote.shipping.currency === "USD" && quote.mandatoryFees.currency === "USD" && quote.shipping.amountMinor >= 0 && quote.mandatoryFees.amountMinor >= 0 ? quote : null;
      const selected=new Map((candidate.variants?.selected??[]).map((option)=>[option.name.toLowerCase(),option.label]));
      normalized.push({
        providerProductId: candidate.id, retailer: offer.domain || domain, retailerDomain: domain,
        sourceUrl: offer.url, sourceType: "live" as const, retrievedAt: this.now().toISOString(),
        productTitle: candidate.title, brand: candidate.brands?.[0]?.name,color:selected.get("color")??candidate.structured_attributes?.color?.[0],size:selected.get("size")??candidate.structured_attributes?.size?.[0],
        productPrice: price, shipping: validQuote?.shipping ?? null, fees: validQuote?.mandatoryFees ?? null,
        deliveredCostSource: validQuote?.method ?? "unknown", deliveredCostRetrievedAt: validQuote?.obtainedAt,
        availability: offer.availability === "InStock" ? "in_stock" as const : offer.availability === "OutOfStock" ? "out_of_stock" as const : "unknown" as const,
        condition: offer.condition === "used" ? "used" as const : offer.condition === "new" ? "new" as const : undefined,
      });
    }
    this.cache.set(key,{expires:this.now().getTime()+60_000,value:structuredClone(normalized)});return normalized;
  }
}

export function createPriceProvider() {
  const mode = process.env.PRICE_DISCOVERY_MODE ?? "fixture";
  if (mode === "fixture") return new FixturePriceProvider();
  if (mode === "channel3"||mode === "live") return new Channel3PriceProvider(process.env.CHANNEL3_API_KEY ?? "",undefined,undefined,undefined,Number(process.env.CHANNEL3_TIMEOUT_SECONDS??8),Number(process.env.CHANNEL3_REQUEST_BUDGET??6));
  throw new Error("PRICE_DISCOVERY_MODE must be fixture or channel3");
}
