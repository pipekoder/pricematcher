import type { z } from "zod";
import type { AgentKind } from "./model";

const paths: Record<AgentKind, ReadonlySet<string>> = {
  "inventory-sales": new Set([
    "root", "items", "items.*", "items.*.key", "items.*.classification",
    "items.*.demandTrend", "items.*.aggressiveness", "items.*.minSuggestedMinor",
    "items.*.maxSuggestedMinor", "items.*.reasons", "items.*.riskFlags",
    "items.*.riskFlags.*",
  ]),
  "market-offer": new Set([
    "root", "items", "items.*", "items.*.key", "items.*.productId",
    "items.*.sku", "items.*.decision", "items.*.proposedUnitMinor",
    "items.*.reference", "items.*.reason", "items.*.limitations",
    "consolidatedSubtotalMinor",
  ]),
};

const codes = new Set(["invalid_type", "invalid_value", "unrecognized_keys", "too_big", "too_small"]);
const categories = new Set(["string", "number", "array", "object", "integer", "enum"]);

export function safeSchemaIssues(agent: AgentKind, issues: readonly z.core.$ZodIssue[]) {
  return {
    issueCount: issues.length,
    issues: issues.slice(0, 8).map((issue) => {
      const candidate = issue.path.length ? issue.path.map((part) => typeof part === "number" ? "*" : typeof part === "string" ? part : "other").join(".") : "root";
      const path = paths[agent].has(candidate) ? candidate : "other";
      const code = codes.has(issue.code) ? issue.code : "other";
      const expected = issue.code === "invalid_value" ? "enum"
        : issue.code === "invalid_type" && "expected" in issue && issue.expected === "int" ? "integer"
        : issue.code === "invalid_type" && "expected" in issue && typeof issue.expected === "string" && categories.has(issue.expected) ? issue.expected
        : undefined;
      return { code, path, ...(expected ? { expected } : {}) };
    }),
  };
}
