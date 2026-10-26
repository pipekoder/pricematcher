# Channel3 real-product demo catalog

This catalog is independent from `lib/catalog.ts` and the fixture provider. It may contain only product and offer data actually returned by Channel3. Fictional store prices remain separately labeled PriceMatcher demo merchant configured prices.

## 2026-10-26 investigation

The credential presence check passed without printing the key. A single controlled script attempted the full six-request budget with `limit: 5`, US/USD `default` mode, a 3-second offer refresh bound, an 8-second request timeout, and `maxRetries: 0`.

| Requested at (UTC) | Query | Result |
| --- | --- | --- |
| 2026-10-26T06:08:01.796Z | Nike Downshifter 14 | Network transport `fetch failed`; no product data |
| 2026-10-26T06:08:01.817Z | Brooks Ghost Max 3 | Network transport `fetch failed`; no product data |
| 2026-10-26T06:08:06.826Z | Apple AirPods Pro 2nd generation USB-C | Network transport `fetch failed`; no product data |
| 2026-10-26T06:08:06.829Z | Sony WH-1000XM5 | Network transport `fetch failed`; no product data |
| 2026-10-26T06:08:11.840Z | Nintendo Switch OLED Model white | Network transport `fetch failed`; no product data |
| 2026-10-26T06:08:11.845Z | Garmin Forerunner 265 black | Network transport `fetch failed`; no product data |

Completed at `2026-10-26T06:08:16.854Z`. Actual API requests used: **6 / 6**. No search returned product IDs, offers, URLs, prices, availability, or variants. Consequently the real-product catalog contains **0 verified products**, and the integration status is **BLOCKED**. Nothing was inferred from Channel3 examples or mocked tests.

## Refresh procedure

Refreshing is opt-in and never runs during build, test, page rendering, or application startup.

1. Confirm `CHANNEL3_API_KEY` exists without printing it.
2. Preview the request plan with `npm run channel3:refresh-demo`. This makes **0 requests**.
3. Set `CHANNEL3_MAX_REQUESTS` to an integer from 1 to 6 and run `npm run channel3:refresh-demo -- --execute` once.
4. Review the sanitized JSON output. Copy only verified fields into `channel3-demo-catalog.ts`, retaining each retrieval timestamp and the matched/differed/missing identity assessment.

The script caps a run at six calls, uses saved Channel3 product IDs before searches when the catalog has them, sets `maxRetries: 0`, and applies an eight-second timeout. With the current empty catalog the preview plans six searches; after verified IDs are saved, retrievals consume the first calls. It never purchases credits.

## Commercial evidence rule

Channel3 `ProductOffer` supplies product price, currency, merchant/domain, URL, availability, condition, and optional dimensions. It does not guarantee shipping or mandatory fees. A live offer missing either value is always `actionable=false`; unknown costs are never treated as zero and cannot create an executable discount. The authorized lower-price scenario remains explicitly **FIXTURE / DEMO**.

Status summary:

- Channel3 real-product catalog: **BLOCKED**
- Live verified products: **0**
- Products with multiple verified merchant offers: **0**
- Existing Channel3 adapter: **LIVE AND VERIFIED** is not claimed
- Fixture authorization scenarios: **FIXTURE / DEMO**
