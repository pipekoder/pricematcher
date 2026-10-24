import { NextResponse } from "next/server";
import { z } from "zod";
import { getPriceIntelligenceService } from "@/lib/server/price-intelligence";

const schema = z.object({ sessionId: z.uuid(), productId: z.string().min(1).max(80), quantity: z.number().int().min(1).max(9) }).strict();
export async function POST(request: Request) {
  try { const input = schema.parse(await request.json()); return NextResponse.json(await getPriceIntelligenceService().compare(input)); }
  catch (error) { const message = error instanceof z.ZodError ? "Invalid comparison request" : error instanceof Error ? error.message : "Comparison unavailable"; return NextResponse.json({ error: message }, { status: error instanceof z.ZodError ? 400 : 503 }); }
}
