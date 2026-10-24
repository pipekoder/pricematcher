import { NextResponse } from "next/server";
import { z } from "zod";
import { OfferValidationError } from "@/lib/persistence/repository";
import { getPriceIntelligenceService } from "@/lib/server/price-intelligence";

const schema = z.object({ sessionId: z.uuid(), productId: z.string().min(1).max(80), quantity: z.number().int().min(1).max(9) }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const input = schema.parse(await request.json()); const { id } = await params; const accepted = await getPriceIntelligenceService().accept({ offerId: id, ...input }); return NextResponse.json({ offerId: accepted.offer.id, status: accepted.offer.status, finalTotal: accepted.offer.finalTotal, currency: accepted.offer.currency, acceptedAt: accepted.offer.acceptedAt }); }
  catch (error) { const status = error instanceof z.ZodError ? 400 : error instanceof OfferValidationError ? (error.code === "unauthorized" ? 403 : 409) : 400; return NextResponse.json({ error: error instanceof Error ? error.message : "Offer could not be accepted" }, { status }); }
}
