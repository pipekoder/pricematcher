export type DatabaseFailureCategory = "configuration"|"dns"|"timeout"|"authentication"|"tls"|"network"|"database"|"unknown";
export type HealthResult = { ok: true; elapsedMs: number } | { ok: false; elapsedMs: number; category: DatabaseFailureCategory };

class HealthDeadlineError extends Error { constructor() { super("Database health check exceeded its deadline"); } }

const codes = {
  dns: new Set(["ENOTFOUND", "EAI_AGAIN", "EAI_FAIL"]),
  timeout: new Set(["ETIMEDOUT", "ESOCKETTIMEDOUT", "CONNECT_TIMEOUT"]),
  authentication: new Set(["28P01", "28000"]),
  tls: new Set(["CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID"]),
  network: new Set(["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "EPIPE"]),
};

export function classifyDatabaseError(error: unknown): DatabaseFailureCategory {
  if (error instanceof HealthDeadlineError) return "timeout";
  const value = error as { code?: unknown; message?: unknown }; const code = typeof value?.code === "string" ? value.code : "";
  if (codes.dns.has(code)) return "dns"; if (codes.timeout.has(code)) return "timeout"; if (codes.authentication.has(code)) return "authentication"; if (codes.tls.has(code)) return "tls"; if (codes.network.has(code)) return "network";
  if (/password authentication failed|authentication failed/i.test(String(value?.message ?? ""))) return "authentication";
  if (/certificate|tls|ssl/i.test(String(value?.message ?? ""))) return "tls";
  if (/timeout|timed out/i.test(String(value?.message ?? ""))) return "timeout";
  if (/DATABASE_URL|required|configuration/i.test(String(value?.message ?? ""))) return "configuration";
  if (/^[0-9A-Z]{5}$/.test(code)) return "database";
  return "unknown";
}

export async function checkDatabaseHealth(check: () => Promise<void>, timeoutMs = 5_500, clock: () => number = () => Date.now()): Promise<HealthResult> {
  const started = clock(); let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([check(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new HealthDeadlineError()), timeoutMs); })]);
    return { ok: true, elapsedMs: Math.max(0, clock() - started) };
  } catch (error) { return { ok: false, elapsedMs: Math.max(0, clock() - started), category: classifyDatabaseError(error) }; }
  finally { if (timer) clearTimeout(timer); }
}
