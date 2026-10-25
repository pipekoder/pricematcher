# Supabase TLS configuration on Render

## What is confirmed

- Render reaches the health route and receives a bounded TLS failure in under half a second.
- In the installed `pg` version, SSL-related `DATABASE_URL` query parameters override an explicit Pool `ssl` object because the connection string is parsed and merged afterward.
- PriceMatcher now strips those competing URL parameters and always enables certificate verification and hostname verification.

## What remains a hypothesis

The redacted `tls` category intentionally does not log certificate or hostname details. The quick failure is consistent with the Supabase pooler certificate chain requiring the Supabase CA, but only a successful connection after installing the project CA will confirm that diagnosis. Do not work around it with `sslmode=no-verify`, `DATABASE_SSL=disable`, or `DATABASE_SSL_REJECT_UNAUTHORIZED=false`; the application now rejects those settings.

## Required Render change

1. In the Supabase Dashboard for this project, open **Project Settings → Database** and download the current SSL root/server CA certificate offered for database connections. Use the certificate supplied by this exact project/region; do not copy a certificate from a blog or another project.
2. Base64-encode the PEM certificate locally as one line. For example on Linux/macOS:

   ```bash
   base64 < path/to/supabase-ca.crt | tr -d '\n'
   ```

3. In Render Environment, create the secret variable `DATABASE_SSL_CA_BASE64` with that one-line value. Do not paste it into source control.
4. Edit `DATABASE_URL` to remove SSL query parameters including `sslmode`, `ssl`, `sslcert`, `sslkey`, and `sslrootcert`. Keep the exact Supabase **Session pooler** hostname, database, username, percent-encoded password, and port `5432`. Other non-SSL query parameters may remain.
5. Keep these values exactly:

   ```text
   DATABASE_SSL=require
   DATABASE_SSL_REJECT_UNAUTHORIZED=true
   ```

6. After this PR is reviewed and merged, trigger a normal Render redeploy. A healthy database returns HTTP 200. A remaining HTTP 503 with category `tls` most likely indicates the wrong/outdated CA or a hostname mismatch; re-download the certificate and verify the pooler hostname. Do not disable verification.

No Supabase data migration, credential rotation, or platform provisioning is required by this code change.
