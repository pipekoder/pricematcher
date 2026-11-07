import { readFile, writeFile } from "node:fs/promises";
import { Channel3 } from "@channel3/sdk";

const query = "Adidas running shoes sneakers";
const oldPath = new URL("../docs/CHANNEL3_PR12_REQUEST_LOG.json", import.meta.url);
const path = new URL("../docs/CHANNEL3_RUNNING_DEMO_LOG.json", import.meta.url);
const old = JSON.parse(await readFile(oldPath, "utf8"));
const log = JSON.parse(await readFile(path, "utf8"));
if (old.requests.length + log.requests.length >= 30) throw new Error("Cumulative Channel3 discovery cap reached");
if (log.requests.some(item => item.query === query)) throw new Error("Adidas search already recorded; no duplicate request");
if (!process.env.CHANNEL3_API_KEY) throw new Error("Channel3 key unavailable; no request made");
const entry = { number: old.requests.length + log.requests.length + 1, purpose: "Verify Adidas footwear for running-shoe demo", query, requestedAt: new Date().toISOString(), status: "pending", result: null };
log.requests.push(entry);
await writeFile(path, `${JSON.stringify(log, null, 2)}\n`);
try {
  const client = new Channel3({ apiKey: process.env.CHANNEL3_API_KEY });
  const response = await client.products.search({ query, limit: 10, config: { country: "US", currency: "USD", mode: "default", offer_refresh_timeout_ms: 3000 } }, { timeoutInSeconds: 10, maxRetries: 0 });
  const products = (response.data ?? []).map(product => ({ id: product.id, title: product.title, brands: product.brands?.map(brand => brand.name) ?? [], description: product.description ?? null, images: (product.images ?? []).map(image => ({ url: image.url ?? null })), variants: product.variants?.selected ?? [], attributes: product.structured_attributes ?? {}, offers: (product.offers ?? []).map(offer => ({ domain: offer.domain, url: offer.url, price: offer.price, availability: offer.availability, condition: offer.condition ?? null })) }));
  entry.status = "success";
  entry.result = { retrievedAt: new Date().toISOString(), products };
  console.log(JSON.stringify({ requestNumber: entry.number, productCount: products.length, candidates: products.map(product => ({ id: product.id, title: product.title, brand: product.brands[0], imageCount: product.images.length, offerCount: product.offers.length })) }));
} catch (error) {
  entry.status = "error";
  entry.result = { name: error instanceof Error ? error.name : "Error", message: error instanceof Error ? error.message.replaceAll(process.env.CHANNEL3_API_KEY, "[REDACTED]") : "Unknown error" };
  console.error(JSON.stringify({ requestNumber: entry.number, error: entry.result }));
  process.exitCode = 1;
} finally {
  await writeFile(path, `${JSON.stringify(log, null, 2)}\n`);
}
