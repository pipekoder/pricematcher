import type { Channel3DemoOffer, Channel3DemoProduct } from "./channel3-demo-catalog";

export type Channel3DemoFamily = {
  id: string;
  name: string;
  brand: string;
  models: string[];
  products: Channel3DemoProduct[];
  offers: Array<Channel3DemoOffer & { productId: string; productName: string; retrievedAt: string; verificationStatus: Channel3DemoProduct["verificationStatus"] }>;
  merchantCount: number;
  priceRange: { minimumMinor: number; maximumMinor: number; currency: "USD" };
};

export function groupChannel3Products(products: Channel3DemoProduct[]): Channel3DemoFamily[] {
  const groups = new Map<string, Channel3DemoProduct[]>();
  for (const product of products) groups.set(product.familyId, [...(groups.get(product.familyId) ?? []), product]);

  return [...groups.entries()].map(([id, familyProducts]) => {
    const offers = familyProducts.flatMap((product) => product.offers.map((offer) => ({
      ...offer,
      productId: product.channel3ProductId,
      productName: product.name,
      retrievedAt: product.retrievedAt,
      verificationStatus: product.verificationStatus,
    }))).sort((left, right) => left.price.amountMinor - right.price.amountMinor);
    const amounts = offers.map((offer) => offer.price.amountMinor);
    return {
      id,
      name: familyProducts[0].familyName,
      brand: familyProducts[0].brand,
      models: [...new Set(familyProducts.map((product) => product.model))],
      products: familyProducts,
      offers,
      merchantCount: new Set(offers.map((offer) => offer.domain)).size,
      priceRange: { minimumMinor: Math.min(...amounts), maximumMinor: Math.max(...amounts), currency: "USD" as const },
    };
  });
}

