# Channel3 real-product demo catalog

The live catalog is independent from `lib/catalog.ts` and the fixture provider. It contains only product and offer fields returned by authenticated Channel3 searches. Fictional store prices and executable authorization examples remain separately labeled **FIXTURE / DEMO**.

## Verified search record

All searches used US/USD `default` mode, `limit: 5`, a three-second offer refresh bound, a bounded request timeout, and `maxRetries: 0`. Credential presence was checked without printing the key.

| Retrieved at (UTC) | Query | Selected records | Selected offers |
| --- | --- | ---: | ---: |
| 2026-10-26T06:55:40.882Z | Nike Downshifter 14 | 5 | 9 |
| 2026-10-26T07:14:38.997Z | Sony WH-1000XM5 | 2 | 7 |
| 2026-10-26T07:15:00.156Z | Apple AirPods Pro 2nd generation USB-C | 3 | 3 |
| 2026-10-26T07:15:22.779Z | Garmin Forerunner 265 | 2 | 3 |
| 2026-10-26T07:15:47.053Z | Nintendo Switch OLED Model white | 2 | 4 |

The original Nike search used one request. The completion session used **4 / 5** permitted additional searches and stopped after verifying four new families. The catalog therefore rests on **5 total authenticated product searches**.

## Catalog summary

| Product family | Channel3 product IDs | Records | Offers | Multi-merchant records |
| --- | --- | ---: | ---: | ---: |
| Nike Downshifter 14 | `kRteKNW`, `9NKNXXR`, `rL4QVw1`, `taUUvTb`, `pcgUHoJ` | 5 | 9 | 3 |
| Sony WH-1000XM5 | `aggqNMU`, `rmAiFzV` | 2 | 7 | 1 |
| Apple AirPods Pro USB-C | `UfUgP5k`, `KAiWQbg`, `UIckAxH` | 3 | 3 | 0 |
| Garmin Forerunner 265 | `ExGJQgW`, `qiuI126` | 2 | 3 | 1 |
| Nintendo Switch OLED — White | `4oT9ZT1`, `OUrIuPy` | 2 | 4 | 1 |
| **Total** | 14 IDs | **14** | **26** | **6** |

Repeated records are grouped into five commercial families; the five Nike records are not presented as five unrelated products. Offers are sorted by observed product price. The lowest observed product price is never described as the lowest delivered price.

## Equivalence rules

- **Exact variant verified** requires a matching stable identifier plus all required variant attributes and no conflicts.
- **Same model — variant not verified** means brand and model evidence agrees, but exact size, color, capacity, generation, condition, GTIN, or MPN evidence is incomplete.
- **Different variant** means a required identifier or variant attribute conflicts.
- **Insufficient evidence** means the returned fields cannot establish product equivalence.

No selected live record currently qualifies as an exact variant. The Sony record `aggqNMU` returns Black / Open Box as the selected variant while its offers contain new, used, and unknown conditions; those offers are not silently treated as equivalent. Apple Lightning results were not added to the USB-C family. The default placeholder evaluator is explicitly marked unavailable and does not set `aiAssisted=true`.

## Commercial evidence rule

Channel3 supplies product price, currency, merchant domain, URL, availability, condition, and optional variant data. It does not supply verified shipping and mandatory-fee totals for these offers. Every live offer therefore stores:

- `shipping: null`
- `mandatoryFees: null`
- `actionable: false`

Unknown shipping is not free shipping. Unknown mandatory fees are not zero. Live product-price differences cannot authorize a checkout adjustment. Merchant-controlled deterministic authorization, original-price checkout, and fixture authorization scenarios are unchanged.

## Refresh procedure

Refreshing is opt-in and never runs during build, test, page rendering, or application startup.

1. Confirm `CHANNEL3_API_KEY` exists without printing it.
2. Preview the request plan with `npm run channel3:refresh-demo`; this makes zero requests.
3. Set `CHANNEL3_MAX_REQUESTS` to an integer from 1 to 6 and run `npm run channel3:refresh-demo -- --execute` once.
4. Review the sanitized JSON output and copy only verified fields, including each retrieval timestamp.

The script prioritizes saved product IDs, caps each run at six calls, disables retries, and never purchases credits.

## Manual QA

1. Open `/channel3-demo` at desktop, tablet, and mobile widths.
2. Confirm the selector shows five families and that Nike appears once.
3. Activate each **View comparison** link using both pointer and keyboard; confirm focus/scroll reaches the corresponding comparison.
4. Confirm offer rows are ordered by product price and merchant links open in a new tab.
5. Confirm every offer displays product-price-only, shipping unknown, mandatory fees unknown, delivered cost unknown, and not actionable.
6. Confirm narrow layouts have no horizontal overflow and merchant evidence remains readable.
7. Confirm fixture authorization scenarios remain explicitly labeled **FIXTURE / DEMO**.

## Remaining limitations

- No selected family has sufficient GTIN/MPN and variant evidence for an exact match.
- Shipping and mandatory fees are unknown for all 26 offers.
- Merchant-domain presence is evidence from Channel3, not independent seller approval.
- Free-credit quota, expiry, and production rate limits remain unverified.
