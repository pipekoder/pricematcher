# Channel3-first PriceMatcher V2

Official references reviewed or attempted:

- <https://trychannel3.com/developers>
- <https://paypalaihackathon.devpost.com/details/channel3>
- <https://github.com/channel3-ai/channel3-ts-sdk>
- installed SDK reference: `node_modules/@channel3/sdk/reference.md`

## Confirmed capabilities

Confirmed from the installed official `@channel3/sdk` 4.5.0 type definitions and bundled reference:

- `products.search` supports text and image input, up to 30 results, filters, pagination, country and currency configuration.
- search mode `default` combines lexical and semantic search; `keyword` is lexical only; `agentic` uses an LLM to plan multiple structured searches and has higher latency.
- product responses include title, brands, category, materials, features, colors, structured attributes, variant selections and merchant offers.
- offers include URL, domain, price, availability, condition and optional dimensions.
- `offer_refresh_timeout_ms` can refresh offer existence and inventory with a bounded 2–10 second wait.
- the SDK supports bounded request timeouts and retry controls.

The product/offer types do **not** provide shipping or mandatory fees. PriceMatcher therefore keeps a live result ineligible unless a separately trusted `DeliveredCostResolver` supplies those values. It never treats an unknown delivered price as zero.

The public documentation pages were unreachable from the development environment because its outbound proxy returned HTTP 403. The current sponsor-credit quota, expiry and production rate limits are therefore **BLOCKED / NOT VERIFIED** and must be confirmed in the Channel3 account before enabling live mode.

## AI classification

`default` mode is genuine documented semantic search and is used by PriceMatcher. Semantic retrieval supplies candidates only. Exact identity, variant, condition, availability, currency, delivered cost, freshness and merchant authorization remain deterministic. Fixture mode is not represented as AI output.

## Runtime controls

```text
PRICE_DISCOVERY_MODE=fixture | channel3
CHANNEL3_API_KEY=server-only
CHANNEL3_TIMEOUT_SECONDS=8
CHANNEL3_REQUEST_BUDGET=6
```

The adapter uses no automatic retries, limits results to five, requests live offer refresh with a three-second bound, caps its in-process per-minute request budget at six and caches identical searches for 60 seconds. The independent real-product refresh is opt-in and documented in `CHANNEL3_REAL_PRODUCT_DEMO.md`; it performs zero requests by default and prioritizes saved product IDs. These controls limit a single instance; a durable distributed quota counter is a known future requirement for horizontally scaled deployments.

There is no silent fallback. `fixture` is visibly labeled demo data; `channel3` errors return truthful per-line `SOURCE_UNAVAILABLE` results.

## Status

- Channel3 SDK integration: **BLOCKED** after credential-present requests failed at the network transport layer on 2026-10-26
- Semantic search configuration: **BLOCKED**; no product response was received
- Shipping/mandatory-fee resolver: **BLOCKED** for live results
- Fixture adapter: **FIXTURE / DEMO**
- Free-credit quota and expiry: **BLOCKED** pending Channel3 account confirmation
