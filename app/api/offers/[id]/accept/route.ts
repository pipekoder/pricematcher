import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { acceptedOfferSummary } from "@/lib/checkout-summary";
import { OfferValidationError } from "@/lib/persistence/repository";
import { getPriceIntelligenceService } from "@/lib/server/price-intelligence";
import { SESSION_COOKIE, verifyAnonymousSession } from "@/lib/server/anonymous-session";

const line = z.object({ productId: z.string().min(1).max(80), variantKey: z.string().min(1).max(180), quantity: z.number().int().min(1).max(9) }).strict();
const schema = z.object({ cart: z.array(line).min(1).max(25) }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const input = schema.parse(await request.json()); const sessionId = verifyAnonymousSession((await cookies()).get(SESSION_COOKIE)?.value); if (!sessionId) return NextResponse.json({ error: "A valid server-issued session is required", code: "unauthorized" }, { status: 401 }); const { id } = await params; const accepted = await getPriceIntelligenceService().accept({ offerId: id, sessionId, cart: input.cart }); const offer=accepted.offer; return NextResponse.json({ offerId: offer.id, status: offer.status, acceptedAt: offer.acceptedAt, summary: acceptedOfferSummary({ offerId:offer.id, originalSubtotal:offer.cartSnapshot.subtotal, shipping:offer.cartSnapshot.shipping, tax:offer.cartSnapshot.tax, fees:offer.cartSnapshot.fees, totalToPay:offer.finalTotal, expiresAt:offer.expiresAt }) }); }
  catch (error) { const status = error instanceof z.ZodError ? 400 : error instanceof OfferValidationError ? (error.code === "unauthorized" ? 403 : 409) : 400; return NextResponse.json({ error: error instanceof Error ? error.message : "Offer could not be accepted", code:error instanceof OfferValidationError?error.code:"invalid_request" }, { status }); }
}
