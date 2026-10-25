# Render health-check diagnosis

## Confirmed findings

- The supplied deployment log proves the GitHub source built, Next.js started, and the web service bound to Render's assigned port `10000`. This is not a source-checkout, build, or port-binding failure.
- Before this change, `/api/health` awaited `pool.query("select 1")` without a pool connection timeout, query timeout, or route deadline. A stalled database connection could therefore keep every Render readiness probe open until Render's deployment timeout.
- `render.yaml` points at the correct route and the start command binds `0.0.0.0:$PORT`. Those settings are not the cause.

## Not established by the available evidence

The existing log does not expose the underlying PostgreSQL error, so it cannot distinguish incorrect credentials, DNS, TCP reachability, or TLS validation. Render and Supabase were not connected to this review environment, and no production credential or database was accessed.

The Supabase Session pooler on port 5432 is the appropriate IPv4-compatible endpoint for this deployment. Supabase expects TLS. PriceMatcher continues to validate certificates by default; do not set `DATABASE_SSL=disable` or `DATABASE_SSL_REJECT_UNAUTHORIZED=false` to hide a certificate problem.

## Behavior after this change

- Pool connection timeout: 4.5 seconds (approximately 5 seconds).
- Query and PostgreSQL statement timeout: 4 seconds.
- Route-level deadline: 4.8 seconds, before a typical five-second probe deadline.
- Idle connections close after 30 seconds and the Free instance uses a maximum of three pooled connections.
- A reachable required database returns HTTP 200. Any failure returns HTTP 503 promptly.
- Logs and responses expose only a safe category: `configuration`, `dns`, `timeout`, `authentication`, `tls`, `network`, `database`, or `unknown`. They never include an error message, hostname, username, URL, password, token, or connection string.

## Manual configuration check

In Render, keep `DATABASE_URL` as a secret and use the exact Supabase **Session pooler** URI, including the database password and port 5432. Preserve any percent-encoding in the password. Keep:

```text
APP_ENV=production
PERSISTENCE_BACKEND=postgres
DATABASE_SSL=require
DATABASE_SSL_REJECT_UNAUTHORIZED=true
```

After redeploying this reviewed change, inspect the single structured `healthcheck_failed` log category if readiness returns 503:

- `authentication`: re-copy the Session-pooler password/username without printing it.
- `dns`: verify the pooler hostname is exact.
- `timeout` or `network`: verify port 5432 and the Session pooler rather than the direct IPv6-only endpoint.
- `tls`: verify the hostname and platform CA configuration; do not disable certificate validation.
- `configuration`: set the missing/invalid Render environment value.

Render Free resource limits can increase cold-start latency, but the supplied log shows Next.js ready in 1.6 seconds. There is no evidence that CPU or memory pressure caused this failure.
