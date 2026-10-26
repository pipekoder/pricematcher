import type { Product, MatchConfidence } from "../types";
import type { DiscoveredOffer } from "./provider";

export type AiEquivalenceEvaluator = { evaluate(product: Product, candidate: DiscoveredOffer): Promise<"probable" | "uncertain" | "mismatch"> };
export const unavailableAiEvaluator: AiEquivalenceEvaluator = { evaluate: async () => "uncertain" };

export async function verifyEquivalence(product: Product, candidate: DiscoveredOffer, ai = unavailableAiEvaluator): Promise<{ match: MatchConfidence; aiAssisted: boolean; reasons: string[] }> {
  const matched = [candidate.brand?.toLowerCase() === product.brand.toLowerCase() ? "brand" : null, candidate.model?.toLowerCase() === product.model.toLowerCase() ? "model" : null, candidate.gtin === product.gtin ? "GTIN" : null, candidate.color?.toLowerCase() === product.variant.color.toLowerCase() ? "color" : null, candidate.size && candidate.size === product.variant.size ? "size" : null, candidate.condition === "new" ? "condition" : null].filter(Boolean) as string[];
  const missing = [["brand", candidate.brand], ["model", candidate.model], ["GTIN", candidate.gtin], ["color", candidate.color], ["condition", candidate.condition]].filter(([, value]) => !value).map(([name]) => name);
  const context = [`Matched: ${matched.length ? matched.join(", ") : "none"}`, `Missing: ${missing.length ? missing.join(", ") : "none"}`];
  if (candidate.condition !== "new") return { match: "mismatch", aiAssisted: false, reasons: [...context, `Differed: ${candidate.condition ? "condition" : "none"}`, "Condition is not confirmed new"] };
  if (candidate.gtin && candidate.gtin !== product.gtin) return { match: "mismatch", aiAssisted: false, reasons: [...context, "Differed: GTIN", "GTIN differs"] };
  if (candidate.color && candidate.color.toLowerCase() !== product.variant.color.toLowerCase()) return { match: "mismatch", aiAssisted: false, reasons: [...context, "Differed: color", "Variant color differs"] };
  if (candidate.gtin === product.gtin && candidate.color?.toLowerCase() === product.variant.color.toLowerCase())
    return { match: "exact", aiAssisted: false, reasons: [...context, "Differed: none", "Exact GTIN and variant"] };
  if (candidate.brand?.toLowerCase() === product.brand.toLowerCase() && candidate.model?.toLowerCase() === product.model.toLowerCase() && candidate.color?.toLowerCase() === product.variant.color.toLowerCase())
    return { match: "exact", aiAssisted: false, reasons: [...context, "Differed: none", "Exact brand, model, and variant"] };
  const result = await ai.evaluate(product, candidate);
  return { match: result, aiAssisted: true, reasons: [...context, "Differed: none observed", result === "probable" ? "AI found a probable identity match; deterministic proof is missing" : "Identity could not be proven"] };
}
