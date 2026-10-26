export type Channel3DemoOffer = {
  merchant: string;
  domain: string;
  url: string;
  price: { amountMinor: number; currency: "USD" };
  availability: "in_stock" | "out_of_stock" | "unknown";
  condition: string | null;
  shipping: null;
  mandatoryFees: null;
  actionable: false;
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
  status: "LIVE_AND_VERIFIED" as const,
  requestedAt: "2026-10-26T06:55:30.000Z",
  completedAt: "2026-10-26T06:55:40.882Z",
  requestCount: 1,
  requestBudget: 6,
  summary: "Authenticated Channel3 search succeeded and returned five verified product records. Shipping and mandatory fees were not returned, so every live offer remains non-actionable.",
  queries: ["Nike Downshifter 14"],
};

const nonActionableOffer = (merchant: string, domain: string, url: string, amountMinor: number): Channel3DemoOffer => ({
  merchant,
  domain,
  url,
  price: { amountMinor, currency: "USD" },
  availability: "in_stock",
  condition: "new",
  shipping: null,
  mandatoryFees: null,
  actionable: false,
});

// Captured from one authenticated Channel3 search on 2026-10-26. No values are
// inferred from documentation, fixtures, or merchant pages.
export const channel3DemoProducts: Channel3DemoProduct[] = [
  {
    channel3ProductId: "kRteKNW",
    name: "Nike Downshifter 14",
    brand: "Nike",
    model: "Downshifter 14",
    variant: { fit: "Regular", cut: "Low cut", activity: "Running" },
    identifiers: {},
    retrievedAt: "2026-10-26T06:55:40.882Z",
    identity: { matched: ["brand", "model", "title"], differed: [], missing: ["GTIN", "MPN", "size", "color"] },
    offers: [nonActionableOffer("nike.com", "nike.com", "https://buy.trychannel3.com/kRteKNW-pxA7-5NDeHv?o=01M5TFZ261ATG4Y1Y63TAGFBG2&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 8000)],
  },
  {
    channel3ProductId: "9NKNXXR",
    name: "Nike Downshifter 14 Running Shoes",
    brand: "Nike",
    model: "Downshifter 14",
    variant: { cut: "Low cut", activities: "Running, Walking", pattern: "Solid, Color-block" },
    identifiers: {},
    retrievedAt: "2026-10-26T06:55:40.882Z",
    identity: { matched: ["brand", "model", "title"], differed: [], missing: ["GTIN", "MPN", "size", "color"] },
    offers: [
      nonActionableOffer("academy.com", "academy.com", "https://buy.trychannel3.com/9NKNXXR-DEoc-5NDeHv?o=01KWHDFP9GCWZGDVQD8ZDDH2JD&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 5599),
      nonActionableOffer("finishline.com", "finishline.com", "https://buy.trychannel3.com/9NKNXXR-61sn-5NDeHv?o=01KXJWHAD4802M4BCPQCP91QX6&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 8000),
    ],
  },
  {
    channel3ProductId: "rL4QVw1",
    name: "Nike Downshifter 14",
    brand: "Nike",
    model: "Downshifter 14",
    variant: { fit: "Wide, Regular", cut: "Low cut", pattern: "Texture, Solid" },
    identifiers: {},
    retrievedAt: "2026-10-26T06:55:40.882Z",
    identity: { matched: ["brand", "model", "title"], differed: [], missing: ["GTIN", "MPN", "size", "color"] },
    offers: [
      nonActionableOffer("zappos.com", "zappos.com", "https://buy.trychannel3.com/rL4QVw1-fsxO-5NDeHv?o=01M4CFPAQ4ENSZTYWN75ECZKN6&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 6097),
      nonActionableOffer("hibbett.com", "hibbett.com", "https://buy.trychannel3.com/rL4QVw1-4XVr-5NDeHv?o=01KRETXJKFPTPT0WNS1FPB8WPX&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 8000),
      nonActionableOffer("kickscrew.com", "kickscrew.com", "https://buy.trychannel3.com/rL4QVw1-hHvi-5NDeHv?o=01M2VDJH3B6XWDVNFEDDE9H633&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 10062),
    ],
  },
  {
    channel3ProductId: "taUUvTb",
    name: "Nike Downshifter 14",
    brand: "Nike",
    model: "Downshifter 14",
    variant: { support: "Neutral", cut: "Low cut", activities: "Running, Walking" },
    identifiers: {},
    retrievedAt: "2026-10-26T06:55:40.882Z",
    identity: { matched: ["brand", "model", "title"], differed: [], missing: ["GTIN", "MPN", "size", "color"] },
    offers: [nonActionableOffer("sidekicks.co.uk", "sidekicks.co.uk", "https://buy.trychannel3.com/taUUvTb-wXmd-5NDeHv?o=01KKNMXQFQC8G8A8RH29J48XFP&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 14600)],
  },
  {
    channel3ProductId: "pcgUHoJ",
    name: "Men's Downshifter 14 Running Shoes",
    brand: "Nike",
    model: "Downshifter 14",
    variant: { fit: "Regular", activities: "Running, Walking, Training", material: "Textile, Nylon, Mesh" },
    identifiers: {},
    retrievedAt: "2026-10-26T06:55:40.882Z",
    identity: { matched: ["brand", "model", "title"], differed: [], missing: ["GTIN", "MPN", "size", "color"] },
    offers: [
      nonActionableOffer("dickssportinggoods.com", "dickssportinggoods.com", "https://buy.trychannel3.com/pcgUHoJ-fdOw-5NDeHv?o=01M35TDYABSY3NM859004VXSFX&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 7999),
      nonActionableOffer("jdsports.com", "jdsports.com", "https://buy.trychannel3.com/pcgUHoJ-NlEl-5NDeHv?o=01KKSVXABTFM53VGPCXEQZTE3J&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 8000),
    ],
  },
];

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
