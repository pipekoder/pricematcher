import { getProduct } from "../catalog";
import { resolveSkuKey } from "./operations";

export function footwearCartLines(items: Record<string, number>) {
  return Object.entries(items).flatMap(([key, quantity]) => {
    const selection = resolveSkuKey(key);
    const product = selection && getProduct(selection.productId);
    return product && selection && quantity > 0 && quantity <= selection.sku.stock
      ? [{ key, product, quantity, sku: selection.sku, variantKey: `${product.sku}:${product.variant.color}:EU${selection.size}:${product.variant.condition}` }]
      : [];
  });
}
