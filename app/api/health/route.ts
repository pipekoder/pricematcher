import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", service: "pricematcher", version: "foundation", timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
