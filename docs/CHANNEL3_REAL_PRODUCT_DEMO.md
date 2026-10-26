# Channel3 real-product demo catalog

This catalog is independent from `lib/catalog.ts` and the fixture provider. It may contain only product and offer data actually returned by Channel3. Fictional store prices remain separately labeled PriceMatcher demo merchant configured prices.

## 2026-10-26 investigation

The credential presence check passed without printing the key. After `NODE_USE_ENV_PROXY=1` was enabled, one authenticated search ran with `limit: 5`, US/USD `default` mode, a 3-second offer refresh bound, an 8-second request timeout, and `maxRetries: 0`.

| Requested at (UTC) | Query | Result |
| --- | --- | --- |
| 2026-10-26T06:55:30.000Z | Nike Downshifter 14 | Success: 5 products and 9 offers |

Completed at `2026-10-26T06:55:40.882Z`. Actual product-search requests used: **1 / 6**. The real-product catalog contains all **5 verified products** returned by that search, including Channel3 product IDs, returned attributes, prices, merchant URLs, availability, condition, and the retrieval timestamp. Three products have multiple merchant offers. Nothing was inferred from Channel3 examples, mocked tests, or merchant pages.

## Refresh procedure

Refreshing is opt-in and never runs during build, test, page rendering, or application startup.

1. Confirm `CHANNEL3_API_KEY` exists without printing it.
2. Preview the request plan with `npm run channel3:refresh-demo`. This makes **0 requests**.
3. Set `CHANNEL3_MAX_REQUESTS` to an integer from 1 to 6 and run `npm run channel3:refresh-demo -- --execute` once.
4. Review the sanitized JSON output. Copy only verified fields into `channel3-demo-catalog.ts`, retaining each retrieval timestamp and the matched/differed/missing identity assessment.

The script caps a run at six calls, uses saved Channel3 product IDs before searches, sets `maxRetries: 0`, and applies an eight-second timeout. Retrievals consume the first calls. It never purchases credits.

## Commercial evidence rule

Channel3 `ProductOffer` supplies product price, currency, merchant/domain, URL, availability, condition, and optional dimensions. It does not guarantee shipping or mandatory fees. A live offer missing either value is always `actionable=false`; unknown costs are never treated as zero and cannot create an executable discount. The authorized lower-price scenario remains explicitly **FIXTURE / DEMO**.

Status summary:

- Channel3 real-product catalog: **LIVE AND VERIFIED**
- Live verified products: **5**
- Products with multiple verified merchant offers: **3**
- Existing Channel3 adapter: **LIVE AND VERIFIED**
- Fixture authorization scenarios: **FIXTURE / DEMO**
