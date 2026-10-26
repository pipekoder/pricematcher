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
  familyId: string;
  familyName: string;
  channel3ProductId: string;
  name: string;
  brand: string;
  model: string;
  variant: Record<string, string>;
  identifiers: Record<string, string>;
  retrievedAt: string;
  identity: { matched: string[]; differed: string[]; missing: string[] };
  verificationStatus: "exact_variant" | "same_product_family" | "variant_mismatch" | "insufficient_evidence";
  verificationExplanation: string;
  offers: Channel3DemoOffer[];
};

export const channel3DemoInvestigation = {
  status: "LIVE_AND_VERIFIED" as const,
  requestedAt: "2026-10-26T06:55:30.000Z",
  completedAt: "2026-10-26T07:15:47.053Z",
  requestCount: 4,
  requestBudget: 5,
  totalSearchCount: 5,
  summary: "Five authenticated Channel3 searches support five distinct product families. Shipping and mandatory fees were not returned, so every live offer remains non-actionable.",
  queries: ["Nike Downshifter 14", "Sony WH-1000XM5", "Apple AirPods Pro 2nd generation USB-C", "Garmin Forerunner 265", "Nintendo Switch OLED Model white"],
};

const nonActionableOffer = (merchant: string, domain: string, url: string, amountMinor: number, condition: string | null = "new"): Channel3DemoOffer => ({
  merchant,
  domain,
  url,
  price: { amountMinor, currency: "USD" },
  availability: "in_stock",
  condition,
  shipping: null,
  mandatoryFees: null,
  actionable: false,
});

// Captured from one authenticated Channel3 search on 2026-10-26. No values are
// inferred from documentation, fixtures, or merchant pages.
export const channel3DemoProducts: Channel3DemoProduct[] = [
  {
    familyId: "nike-downshifter-14",
    familyName: "Nike Downshifter 14",
    channel3ProductId: "kRteKNW",
    name: "Nike Downshifter 14",
    brand: "Nike",
    model: "Downshifter 14",
    variant: { fit: "Regular", cut: "Low cut", activity: "Running" },
    identifiers: {},
    retrievedAt: "2026-10-26T06:55:40.882Z",
    identity: { matched: ["brand", "model", "title"], differed: [], missing: ["GTIN", "MPN", "size", "color"] },
    verificationStatus: "same_product_family",
    verificationExplanation: "Brand and model match; exact size, color, GTIN, and MPN were not returned.",
    offers: [nonActionableOffer("nike.com", "nike.com", "https://buy.trychannel3.com/kRteKNW-pxA7-5NDeHv?o=01M5TFZ261ATG4Y1Y63TAGFBG2&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 8000)],
  },
  {
    familyId: "nike-downshifter-14",
    familyName: "Nike Downshifter 14",
    channel3ProductId: "9NKNXXR",
    name: "Nike Downshifter 14 Running Shoes",
    brand: "Nike",
    model: "Downshifter 14",
    variant: { cut: "Low cut", activities: "Running, Walking", pattern: "Solid, Color-block" },
    identifiers: {},
    retrievedAt: "2026-10-26T06:55:40.882Z",
    identity: { matched: ["brand", "model", "title"], differed: [], missing: ["GTIN", "MPN", "size", "color"] },
    verificationStatus: "same_product_family",
    verificationExplanation: "Brand and model match; exact size, color, GTIN, and MPN were not returned.",
    offers: [
      nonActionableOffer("academy.com", "academy.com", "https://buy.trychannel3.com/9NKNXXR-DEoc-5NDeHv?o=01KWHDFP9GCWZGDVQD8ZDDH2JD&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 5599),
      nonActionableOffer("finishline.com", "finishline.com", "https://buy.trychannel3.com/9NKNXXR-61sn-5NDeHv?o=01KXJWHAD4802M4BCPQCP91QX6&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 8000),
    ],
  },
  {
    familyId: "nike-downshifter-14",
    familyName: "Nike Downshifter 14",
    channel3ProductId: "rL4QVw1",
    name: "Nike Downshifter 14",
    brand: "Nike",
    model: "Downshifter 14",
    variant: { fit: "Wide, Regular", cut: "Low cut", pattern: "Texture, Solid" },
    identifiers: {},
    retrievedAt: "2026-10-26T06:55:40.882Z",
    identity: { matched: ["brand", "model", "title"], differed: [], missing: ["GTIN", "MPN", "size", "color"] },
    verificationStatus: "same_product_family",
    verificationExplanation: "Brand and model match; exact size, color, GTIN, and MPN were not returned.",
    offers: [
      nonActionableOffer("zappos.com", "zappos.com", "https://buy.trychannel3.com/rL4QVw1-fsxO-5NDeHv?o=01M4CFPAQ4ENSZTYWN75ECZKN6&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 6097),
      nonActionableOffer("hibbett.com", "hibbett.com", "https://buy.trychannel3.com/rL4QVw1-4XVr-5NDeHv?o=01KRETXJKFPTPT0WNS1FPB8WPX&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 8000),
      nonActionableOffer("kickscrew.com", "kickscrew.com", "https://buy.trychannel3.com/rL4QVw1-hHvi-5NDeHv?o=01M2VDJH3B6XWDVNFEDDE9H633&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 10062),
    ],
  },
  {
    familyId: "nike-downshifter-14",
    familyName: "Nike Downshifter 14",
    channel3ProductId: "taUUvTb",
    name: "Nike Downshifter 14",
    brand: "Nike",
    model: "Downshifter 14",
    variant: { support: "Neutral", cut: "Low cut", activities: "Running, Walking" },
    identifiers: {},
    retrievedAt: "2026-10-26T06:55:40.882Z",
    identity: { matched: ["brand", "model", "title"], differed: [], missing: ["GTIN", "MPN", "size", "color"] },
    verificationStatus: "same_product_family",
    verificationExplanation: "Brand and model match; exact size, color, GTIN, and MPN were not returned.",
    offers: [nonActionableOffer("sidekicks.co.uk", "sidekicks.co.uk", "https://buy.trychannel3.com/taUUvTb-wXmd-5NDeHv?o=01KKNMXQFQC8G8A8RH29J48XFP&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 14600)],
  },
  {
    familyId: "nike-downshifter-14",
    familyName: "Nike Downshifter 14",
    channel3ProductId: "pcgUHoJ",
    name: "Men's Downshifter 14 Running Shoes",
    brand: "Nike",
    model: "Downshifter 14",
    variant: { fit: "Regular", activities: "Running, Walking, Training", material: "Textile, Nylon, Mesh" },
    identifiers: {},
    retrievedAt: "2026-10-26T06:55:40.882Z",
    identity: { matched: ["brand", "model", "title"], differed: [], missing: ["GTIN", "MPN", "size", "color"] },
    verificationStatus: "same_product_family",
    verificationExplanation: "Brand and model match; exact size, color, GTIN, and MPN were not returned.",
    offers: [
      nonActionableOffer("dickssportinggoods.com", "dickssportinggoods.com", "https://buy.trychannel3.com/pcgUHoJ-fdOw-5NDeHv?o=01M35TDYABSY3NM859004VXSFX&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 7999),
      nonActionableOffer("jdsports.com", "jdsports.com", "https://buy.trychannel3.com/pcgUHoJ-NlEl-5NDeHv?o=01KKSVXABTFM53VGPCXEQZTE3J&aid=01M5VFWH9VB5FDPHSCHW2YJG79", 8000),
    ],
  },
  {
    familyId: "sony-wh-1000xm5", familyName: "Sony WH-1000XM5", channel3ProductId: "aggqNMU",
    name: "Sony WH-1000XM5 Wireless Noise Canceling Headphones", brand: "Sony", model: "WH-1000XM5",
    variant: { color: "Black", selectedCondition: "Open Box" }, identifiers: {}, retrievedAt: "2026-10-26T07:14:38.997Z",
    identity: { matched: ["brand", "model", "color"], differed: ["offer condition varies"], missing: ["GTIN", "MPN"] },
    verificationStatus: "same_product_family", verificationExplanation: "Brand, model, and black color are supported, but offer conditions conflict with the selected Open Box variant and stable identifiers are missing.",
    offers: [
      nonActionableOffer("beachcamera.com", "beachcamera.com", "https://buy.trychannel3.com/aggqNMU-RnUy-5NDeHv?o=01M30G3N8XE0XGPF9W9T6ZW1A7&aid=01M5VGZ8QYEDB9H9D3CP2KZXGN", 18900, "used"),
      nonActionableOffer("bhphotovideo.com", "bhphotovideo.com", "https://buy.trychannel3.com/aggqNMU-oHaU-5NDeHv?o=01M3C6JB3R1GBJRT72SJDKVAA8&aid=01M5VGZ8QYEDB9H9D3CP2KZXGN", 19800),
      nonActionableOffer("backmarket.com", "backmarket.com", "https://buy.trychannel3.com/aggqNMU-n0yg-5NDeHv?o=01KGAN1V63B0Q55B2WQQYPFFJX&aid=01M5VGZ8QYEDB9H9D3CP2KZXGN", 22100, null),
      nonActionableOffer("focuscamera.com", "focuscamera.com", "https://buy.trychannel3.com/aggqNMU-ZQQu-5NDeHv?o=01M3W3QHY7BGFY7EC530Q3945M&aid=01M5VGZ8QYEDB9H9D3CP2KZXGN", 29800),
      nonActionableOffer("crutchfield.com", "crutchfield.com", "https://buy.trychannel3.com/aggqNMU-Fn95-5NDeHv?o=01KJ9TQ4QD5SPF4EZ21XB19F8H&aid=01M5VGZ8QYEDB9H9D3CP2KZXGN", 29800),
      nonActionableOffer("officedepot.com", "officedepot.com", "https://buy.trychannel3.com/aggqNMU-6Uzl-5NDeHv?o=01M2QS8042XE5J7W560Z6RQYPW&aid=01M5VGZ8QYEDB9H9D3CP2KZXGN", 39809),
    ],
  },
  {
    familyId: "sony-wh-1000xm5", familyName: "Sony WH-1000XM5", channel3ProductId: "rmAiFzV",
    name: "WH-1000XM5 Wireless Over-Ear Noise Canceling Headphones", brand: "Sony", model: "WH-1000XM5",
    variant: { connectivity: "Bluetooth, USB, Wired" }, identifiers: {}, retrievedAt: "2026-10-26T07:14:38.997Z",
    identity: { matched: ["brand", "model"], differed: [], missing: ["GTIN", "MPN", "color"] },
    verificationStatus: "same_product_family", verificationExplanation: "Brand and model match; color and stable identifiers were not returned.",
    offers: [nonActionableOffer("macys.com", "macys.com", "https://buy.trychannel3.com/rmAiFzV-K6RA-5NDeHv?o=01M1HVWXNVVMC46RX7MGP1A5VH&aid=01M5VGZ8QYEDB9H9D3CP2KZXGN", 30041)],
  },
  {
    familyId: "apple-airpods-pro-usbc", familyName: "Apple AirPods Pro USB-C", channel3ProductId: "UfUgP5k",
    name: "AirPod Pro 2nd Gen USB-C Bundle", brand: "Apple", model: "AirPods Pro 2nd Gen",
    variant: { charging: "USB Type-C", bundle: "Yes" }, identifiers: {}, retrievedAt: "2026-10-26T07:15:00.156Z",
    identity: { matched: ["brand", "model generation", "USB-C"], differed: [], missing: ["GTIN", "MPN", "bundle contents"] },
    verificationStatus: "same_product_family", verificationExplanation: "The title supports second generation and USB-C, but stable identifiers and bundle contents are missing.",
    offers: [nonActionableOffer("qvc.com", "qvc.com", "https://buy.trychannel3.com/UfUgP5k-mn23-5NDeHv?o=01M3SBS9A15M79V538S791YT2Q&aid=01M5VGZXDB3KB4BR90S7V9HSYT", 34499)],
  },
  {
    familyId: "apple-airpods-pro-usbc", familyName: "Apple AirPods Pro USB-C", channel3ProductId: "KAiWQbg",
    name: "AirPods Pro", brand: "Apple", model: "AirPods Pro",
    variant: { charging: "USB Type-C", style: "Earbuds" }, identifiers: {}, retrievedAt: "2026-10-26T07:15:00.156Z",
    identity: { matched: ["brand", "model family", "USB-C"], differed: [], missing: ["GTIN", "MPN", "generation"] },
    verificationStatus: "same_product_family", verificationExplanation: "AirPods Pro and USB-C are supported; generation and stable identifiers are missing.",
    offers: [nonActionableOffer("6ave.com", "6ave.com", "https://buy.trychannel3.com/KAiWQbg-hFQq-5NDeHv?o=01M0SX41QGSB2107VQJQAZVYVE&aid=01M5VGZXDB3KB4BR90S7V9HSYT", 28495)],
  },
  {
    familyId: "apple-airpods-pro-usbc", familyName: "Apple AirPods Pro USB-C", channel3ProductId: "UIckAxH",
    name: "AirPods Pro", brand: "Apple", model: "AirPods Pro",
    variant: { charging: "USB Type-C, MagSafe", style: "Canal" }, identifiers: {}, retrievedAt: "2026-10-26T07:15:00.156Z",
    identity: { matched: ["brand", "model family", "USB-C"], differed: [], missing: ["GTIN", "MPN", "generation"] },
    verificationStatus: "same_product_family", verificationExplanation: "AirPods Pro and USB-C are supported; generation and stable identifiers are missing.",
    offers: [nonActionableOffer("6ave.com", "6ave.com", "https://buy.trychannel3.com/UIckAxH-hFQq-5NDeHv?o=01M0SW2WN1R45EPYJWDQS669SE&aid=01M5VGZXDB3KB4BR90S7V9HSYT", 26495)],
  },
  {
    familyId: "garmin-forerunner-265", familyName: "Garmin Forerunner 265", channel3ProductId: "ExGJQgW",
    name: "Garmin Forerunner 265", brand: "Garmin", model: "Forerunner 265",
    variant: { pattern: "Solid" }, identifiers: {}, retrievedAt: "2026-10-26T07:15:22.779Z",
    identity: { matched: ["brand", "model"], differed: [], missing: ["GTIN", "MPN", "color", "case size"] },
    verificationStatus: "same_product_family", verificationExplanation: "Brand and model match; color, case size, and stable identifiers were not returned.",
    offers: [
      nonActionableOffer("lowes.com", "lowes.com", "https://buy.trychannel3.com/ExGJQgW-Qqxu-5NDeHv?o=01M4WKM0E7J8HECX4CDNVM73XZ&aid=01M5VH0KG4T1DDBP9SQGFR8X20", 44999),
      nonActionableOffer("macys.com", "macys.com", "https://buy.trychannel3.com/ExGJQgW-K6RA-5NDeHv?o=01M3GFRPZPDMFY37GR3T0H3KF6&aid=01M5VH0KG4T1DDBP9SQGFR8X20", 44999),
    ],
  },
  {
    familyId: "garmin-forerunner-265", familyName: "Garmin Forerunner 265", channel3ProductId: "qiuI126",
    name: "Garmin Forerunner 265", brand: "Garmin", model: "Forerunner 265",
    variant: { pattern: "Solid" }, identifiers: {}, retrievedAt: "2026-10-26T07:15:22.779Z",
    identity: { matched: ["brand", "model"], differed: [], missing: ["GTIN", "MPN", "color", "case size"] },
    verificationStatus: "same_product_family", verificationExplanation: "Brand and model match; color, case size, and stable identifiers were not returned.",
    offers: [nonActionableOffer("roadrunnersports.com", "roadrunnersports.com", "https://buy.trychannel3.com/qiuI126-jMOb-5NDeHv?o=01M4DT5PRF57XE92SQ7GTNKZPV&aid=01M5VH0KG4T1DDBP9SQGFR8X20", 44999)],
  },
  {
    familyId: "nintendo-switch-oled-white", familyName: "Nintendo Switch OLED — White", channel3ProductId: "4oT9ZT1",
    name: "Nintendo Switch OLED Model with White Controllers", brand: "Nintendo", model: "Switch OLED",
    variant: { controllers: "White", consoleType: "Handheld, Hybrid" }, identifiers: {}, retrievedAt: "2026-10-26T07:15:47.053Z",
    identity: { matched: ["brand", "model", "white controllers"], differed: ["offer condition varies"], missing: ["GTIN", "MPN"] },
    verificationStatus: "same_product_family", verificationExplanation: "The title supports the white-controller model, but stable identifiers are missing and one offer has unknown condition.",
    offers: [
      nonActionableOffer("backmarket.com", "backmarket.com", "https://buy.trychannel3.com/4oT9ZT1-n0yg-5NDeHv?o=01M382SBCQJWREGYS64P5SG753&aid=01M5VH1B7385VSG8JGX81GDS8E", 25800, null),
      nonActionableOffer("samsclub.com", "samsclub.com", "https://buy.trychannel3.com/4oT9ZT1-dCgO-5NDeHv?o=01M4HWC2DSK8BQQKPYSTZ5Q9CV&aid=01M5VH1B7385VSG8JGX81GDS8E", 39900),
      nonActionableOffer("bloomingdales.com", "bloomingdales.com", "https://buy.trychannel3.com/4oT9ZT1-DyQi-5NDeHv?o=01M3VA6AE8W2RE3RQZN9Z8QRPB&aid=01M5VH1B7385VSG8JGX81GDS8E", 39999),
    ],
  },
  {
    familyId: "nintendo-switch-oled-white", familyName: "Nintendo Switch OLED — White", channel3ProductId: "OUrIuPy",
    name: "Switch OLED Model", brand: "Nintendo", model: "Switch OLED",
    variant: { consoleType: "Hybrid" }, identifiers: {}, retrievedAt: "2026-10-26T07:15:47.053Z",
    identity: { matched: ["brand", "model"], differed: [], missing: ["GTIN", "MPN", "controller color"] },
    verificationStatus: "same_product_family", verificationExplanation: "Brand and model match; controller color and stable identifiers were not returned.",
    offers: [nonActionableOffer("walmart.com", "walmart.com", "https://buy.trychannel3.com/OUrIuPy-BsaX-5NDeHv?o=01M388KC5M5N88NMBQG4XDVNXX&aid=01M5VH1B7385VSG8JGX81GDS8E", 36791)],
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
