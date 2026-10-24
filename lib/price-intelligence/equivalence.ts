import type { Product, MatchConfidence } from "../types";
import type { DiscoveredOffer } from "./provider";

export type AiEquivalenceEvaluator = { evaluate(product: Product, candidate: DiscoveredOffer): Promise<"probable" | "uncertain" | "mismatch"> };
export const unavailableAiEvaluator: AiEquivalenceEvaluator = { evaluate: async () => "uncertain" };

export async function verifyEquivalence(product: Product, candidate: DiscoveredOffer, ai = unavailableAiEvaluator): Promise<{ match: MatchConfidence; aiAssisted: boolean; reasons: string[] }> {
  if (candidate.condition !== "new") return { match: "mismatch", aiAssisted: false, reasons: ["Condition is not confirmed new"] };
  if (candidate.gtin && candidate.gtin !== product.gtin) return { match: "mismatch", aiAssisted: false, reasons: ["GTIN differs"] };
  if (candidate.color && candidate.color.toLowerCase() !== product.variant.color.toLowerCase()) return { match: "mismatch", aiAssisted: false, reasons: ["Variant color differs"] };
  if (candidate.gtin === product.gtin && candidate.color?.toLowerCase() === product.variant.color.toLowerCase())
    return { match: "exact", aiAssisted: false, reasons: ["Exact GTIN and variant"] };
  if (candidate.brand?.toLowerCase() === product.brand.toLowerCase() && candidate.model?.toLowerCase() === product.model.toLowerCase() && candidate.color?.toLowerCase() === product.variant.color.toLowerCase())
    return { match: "exact", aiAssisted: false, reasons: ["Exact brand, model, and variant"] };
  const result = await ai.evaluate(product, candidate);
  return { match: result, aiAssisted: true, reasons: [result === "probable" ? "AI found a probable identity match; deterministic proof is missing" : "Identity could not be proven"] };
}
