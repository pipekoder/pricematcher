import { NextResponse } from "next/server";
import { checkDatabaseHealth, classifyDatabaseError } from "../../../lib/server/database-health";
import { getPersistence } from "../../../lib/server/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  try {
    const configuredTimeout=Number(process.env.DATABASE_HEALTH_TIMEOUT_MS);const timeoutMs=Number.isInteger(configuredTimeout)&&configuredTimeout>0?configuredTimeout:4_800;
    const persistence = getPersistence(); const result = await checkDatabaseHealth(persistence.check,timeoutMs);
    if (result.ok) return NextResponse.json({ status: "ok", service: "pricematcher", version: "render-health-v1", persistence: persistence.backend, timestamp }, { headers: { "Cache-Control": "no-store" } });
    console.error(JSON.stringify({ event: "healthcheck_failed", category: result.category, backend: persistence.backend, elapsedMs: result.elapsedMs }));
    return NextResponse.json({ status: "unavailable", service: "pricematcher", reason: "persistence_unavailable", category: result.category, timestamp }, { status: 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const category=classifyDatabaseError(error);
    console.error(JSON.stringify({ event: "healthcheck_failed", category, backend: "unconfigured", elapsedMs: 0 }));
    return NextResponse.json({ status: "unavailable", service: "pricematcher", reason: "persistence_unavailable", category, timestamp }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
