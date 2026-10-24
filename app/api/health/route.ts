import { NextResponse } from "next/server";
import { getPersistence } from "@/lib/server/persistence";

export async function GET() {
  try { const persistence=getPersistence(); await persistence.check(); return NextResponse.json({ status: "ok", service: "pricematcher", version: "payment-readiness", persistence: persistence.backend, timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ status: "unavailable", service: "pricematcher", reason: "persistence_unavailable", timestamp: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
