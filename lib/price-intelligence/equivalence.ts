import type { Product, MatchConfidence } from "../types";
import type { DiscoveredOffer } from "./provider";

export type AiEquivalenceEvaluator = {
  source: "ai" | "unavailable";
  evaluate(product: Product, candidate: DiscoveredOffer): Promise<"probable" | "uncertain" | "mismatch">;
};
export const unavailableAiEvaluator: AiEquivalenceEvaluator = { source: "unavailable", evaluate: async () => "uncertain" };

export async function verifyEquivalence(product: Product, candidate: DiscoveredOffer, ai = unavailableAiEvaluator): Promise<{ match: MatchConfidence; aiAssisted: boolean; reasons: string[] }> {
  const matched = [candidate.brand?.toLowerCase() === product.brand.toLowerCase() ? "brand" : null, candidate.model?.toLowerCase() === product.model.toLowerCase() ? "model" : null, candidate.gtin === product.gtin ? "GTIN" : null, candidate.color?.toLowerCase() === product.variant.color.toLowerCase() ? "color" : null, candidate.size && candidate.size === product.variant.size ? "size" : null, candidate.condition === "new" ? "condition" : null].filter(Boolean) as string[];
  const missing = [["brand", candidate.brand], ["model", candidate.model], ["GTIN", candidate.gtin], ["color", candidate.color], ["condition", candidate.condition], ...(product.variant.size ? [["size", candidate.size]] : [])].filter(([, value]) => !value).map(([name]) => name);
  const context = [`Matched: ${matched.length ? matched.join(", ") : "none"}`, `Missing: ${missing.length ? missing.join(", ") : "none"}`];
  if (candidate.brand && candidate.brand.toLowerCase() !== product.brand.toLowerCase()) return { match: "mismatch", aiAssisted: false, reasons: [...context, "Differed: brand", "Brand differs"] };
  if (candidate.model && candidate.model.toLowerCase() !== product.model.toLowerCase()) return { match: "mismatch", aiAssisted: false, reasons: [...context, "Differed: model", "Model differs"] };
  if (candidate.condition && candidate.condition !== "new") return { match: "mismatch", aiAssisted: false, reasons: [...context, "Differed: condition", "Condition conflicts with the required new condition"] };
  if (candidate.gtin && candidate.gtin !== product.gtin) return { match: "mismatch", aiAssisted: false, reasons: [...context, "Differed: GTIN", "GTIN differs"] };
  if (candidate.color && candidate.color.toLowerCase() !== product.variant.color.toLowerCase()) return { match: "mismatch", aiAssisted: false, reasons: [...context, "Differed: color", "Variant color differs"] };
  if (product.variant.size && candidate.size && candidate.size !== product.variant.size)
    return { match: "mismatch", aiAssisted: false, reasons: [...context, "Differed: size", "Variant size differs"] };
  const exactVariant = candidate.color?.toLowerCase() === product.variant.color.toLowerCase()
    && (!product.variant.size || candidate.size === product.variant.size)
    && candidate.condition === product.variant.condition;
  if (candidate.gtin === product.gtin && exactVariant)
    return { match: "exact", aiAssisted: false, reasons: [...context, "Differed: none", "Exact GTIN and required variant attributes"] };
  if (ai.source === "unavailable") return { match: "uncertain", aiAssisted: false, reasons: [...context, "Differed: none observed", "Same-family evidence may exist, but exact identifiers and required variant attributes are incomplete; no AI evaluator was called"] };
  const result = await ai.evaluate(product, candidate);
  return { match: result, aiAssisted: true, reasons: [...context, "Differed: none observed", result === "probable" ? "AI found a probable identity match; deterministic proof is missing" : "Identity could not be proven"] };
}
