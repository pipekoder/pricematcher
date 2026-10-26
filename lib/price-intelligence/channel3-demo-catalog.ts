export type Channel3DemoOffer = {
  merchant: string;
  domain: string;
  url: string;
  price: { amountMinor: number; currency: "USD" };
  availability: "in_stock" | "out_of_stock" | "unknown";
};

export type Channel3DemoProduct = {
  channel3ProductId: string;
  name: string;
  brand: string;
  model: string;
  variant: Record<string, string>;
  identifiers: Record<string, string>;
  retrievedAt: string;
  identity: { matched: string[]; differed: string[]; missing: string[] };
  offers: Channel3DemoOffer[];
};

export const channel3DemoInvestigation = {
  status: "BLOCKED" as const,
  requestedAt: "2026-10-26T06:08:01.796Z",
  completedAt: "2026-10-26T06:08:16.854Z",
  requestCount: 6,
  requestBudget: 6,
  failure: "All six bounded searches failed at the network transport layer before returning product data.",
  queries: [
    "Nike Downshifter 14",
    "Brooks Ghost Max 3",
    "Apple AirPods Pro 2nd generation USB-C",
    "Sony WH-1000XM5",
    "Nintendo Switch OLED Model white",
    "Garmin Forerunner 265 black",
  ],
};

// Intentionally empty: the bounded investigation returned no verifiable product data.
// Never populate this list from documentation examples, fixtures, or hand-authored offers.
export const channel3DemoProducts: Channel3DemoProduct[] = [];

export const channel3DemoScenarios = [
  {
    id: "already-competitive",
    title: "Merchant price already competitive",
    evidence: "FIXTURE / DEMO",
    actionable: false,
    explanation: "The fixture competitor delivered total is higher than the separately labeled PriceMatcher demo merchant price.",
  },
  {
    id: "competitor-lower",
    title: "Verified competitor lower price",
    evidence: "FIXTURE / DEMO",
    actionable: true,
    explanation: "The authorized-discount flow uses fixture identity and delivered-cost evidence only; it is not a live market-price claim.",
  },
  {
    id: "insufficient-evidence",
    title: "Identity or commercial evidence insufficient",
    evidence: "LIVE LIMITATION",
    actionable: false,
    explanation: "Channel3 offers do not guarantee shipping or mandatory fees. Missing delivered-cost evidence cannot authorize a discount.",
  },
] as const;
