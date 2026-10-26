import { describe, expect, it } from "vitest";
import { products } from "../catalog";
import { productOperations, simulatedInventoryMovements, simulatedPriceHistory, simulatedTransactions, virtualSkus } from "./operations";

describe("reproducible simulated retail ledger", () => {
  it("reconciles SKU and product inventory after sales and returns", () => {
    for (const sku of virtualSkus) {
      expect(simulatedInventoryMovements.filter(item => item.sku === sku.sku).reduce((sum,item) => sum + item.units,0)).toBe(sku.stock);
    }
    for (const product of products) {
      expect(productOperations(product.id).stock).toBe(virtualSkus.filter(sku => sku.productId === product.id).reduce((sum,sku) => sum + sku.stock,0));
    }
  });
  it("bounds sales and price history to their labeled windows", () => {
    expect(simulatedTransactions.every(item => item.day >= 0 && item.day <= 60)).toBe(true);
    expect(simulatedPriceHistory.every(item => item.dayAgo >= 0 && item.dayAgo <= 90)).toBe(true);
    expect(simulatedTransactions.some(item => item.kind === "return")).toBe(true);
  });
});
