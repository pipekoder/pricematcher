import { Channel3 } from "@channel3/sdk";

const MAX_BUDGET = 6;
const savedProductIds = [
  "kRteKNW", "9NKNXXR", "rL4QVw1", "taUUvTb", "pcgUHoJ",
  "aggqNMU", "rmAiFzV", "UfUgP5k", "KAiWQbg", "UIckAxH",
  "ExGJQgW", "qiuI126", "4oT9ZT1", "OUrIuPy",
];
const searchQueries = [
  "Nike Downshifter 14",
  "Brooks Ghost Max 3",
  "Apple AirPods Pro 2nd generation USB-C",
  "Sony WH-1000XM5",
  "Nintendo Switch OLED Model white",
  "Garmin Forerunner 265 black",
];

const execute = process.argv.includes("--execute");
const requestedBudget = Number(process.env.CHANNEL3_MAX_REQUESTS ?? MAX_BUDGET);
if (!Number.isSafeInteger(requestedBudget) || requestedBudget < 1 || requestedBudget > MAX_BUDGET) {
  throw new Error(`CHANNEL3_MAX_REQUESTS must be an integer from 1 to ${MAX_BUDGET}`);
}

const plan = [
  ...savedProductIds.map((id) => ({ kind: "retrieve", value: id })),
  ...searchQueries.map((query) => ({ kind: "search", value: query })),
].slice(0, requestedBudget);

if (!execute) {
  console.log(JSON.stringify({ execute: false, plannedRequests: plan.length, maxBudget: MAX_BUDGET, plan }, null, 2));
  process.exit(0);
}
if (!process.env.CHANNEL3_API_KEY || process.env.CHANNEL3_API_KEY.length <= 10) {
  throw new Error("CHANNEL3_API_KEY is not configured; no requests were made");
}

const client = new Channel3({ apiKey: process.env.CHANNEL3_API_KEY });
const results = [];
for (const item of plan) {
  try {
    const response = item.kind === "retrieve"
      ? await client.products.retrieve({ product_id: item.value }, { timeoutInSeconds: 8, maxRetries: 0 })
      : await client.products.search({ query: item.value, limit: 5, config: { country: "US", currency: "USD", mode: "default", offer_refresh_timeout_ms: 3000 } }, { timeoutInSeconds: 8, maxRetries: 0 });
    const products = item.kind === "retrieve" ? [response] : response.data;
    results.push({ ...item, retrievedAt: new Date().toISOString(), products: products.map((product) => ({ id: product.id, title: product.title, brands: product.brands?.map(({ id, name }) => ({ id, name })) ?? [], variants: product.variants ?? null, structuredAttributes: product.structured_attributes ?? {}, offers: (product.offers ?? []).map((offer) => ({ domain: offer.domain, url: offer.url, price: offer.price, availability: offer.availability, condition: offer.condition ?? null })) })) });
  } catch (error) {
    results.push({ ...item, retrievedAt: new Date().toISOString(), error: error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError", message: "Unknown error" } });
  }
}
console.log(JSON.stringify({ requestCount: plan.length, results }, null, 2));
