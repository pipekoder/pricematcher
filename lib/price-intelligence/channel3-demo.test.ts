import { describe, expect, it } from "vitest";
import { channel3DemoProducts } from "./channel3-demo-catalog";
import { groupChannel3Products } from "./channel3-demo";

describe("Channel3 real-product demo catalog", () => {
  const families = groupChannel3Products(channel3DemoProducts);

  it("groups repeated product records into distinct commercial families", () => {
    expect(families).toHaveLength(5);
    expect(families.find((family) => family.id === "nike-downshifter-14")?.products).toHaveLength(5);
  });

  it("sorts multi-merchant comparisons by observed product price", () => {
    const sony = families.find((family) => family.id === "sony-wh-1000xm5")!;
    expect(sony.merchantCount).toBeGreaterThan(1);
    expect(sony.offers.map((offer) => offer.price.amountMinor)).toEqual(
      [...sony.offers].map((offer) => offer.price.amountMinor).sort((left, right) => left - right),
    );
  });

  it("keeps unknown shipping and mandatory fees non-actionable", () => {
    const offers = families.flatMap((family) => family.offers);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => offer.shipping === null && offer.mandatoryFees === null && !offer.actionable)).toBe(true);
  });

  it("does not promote same-family records to exact variants without identifiers", () => {
    expect(channel3DemoProducts.every((product) => product.verificationStatus !== "exact_variant")).toBe(true);
    expect(channel3DemoProducts.every((product) => product.identity.missing.length > 0)).toBe(true);
  });
});
