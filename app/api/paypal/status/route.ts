import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCartSnapshot, cartFingerprint } from "@/lib/price-intelligence/service";
import { SESSION_COOKIE, verifyAnonymousSession } from "@/lib/server/anonymous-session";
import { getPersistence } from "@/lib/server/persistence";

const line = z.object({ productId: z.string().min(1).max(80), variantKey: z.string().min(1).max(180), quantity: z.number().int().min(1).max(9) }).strict();
const schema = z.object({ checkoutAttemptId: z.uuid(), cart: z.array(line).min(1).max(25) }).strict();

// Read-only recovery. An attempt ID alone never authorizes disclosure: session and
// current server-derived cart fingerprint must both match the stored checkout.
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const sessionId = verifyAnonymousSession((await cookies()).get(SESSION_COOKIE)?.value);
    if (!sessionId) return NextResponse.json({ error: "Valid session required" }, { status: 401 });
    const fingerprint = cartFingerprint(sessionId, buildCartSnapshot(input.cart));
    const persistence = getPersistence();
    const attempt = await persistence.transactions.getCheckoutAttempt(input.checkoutAttemptId);
    if (!attempt || attempt.sessionId !== sessionId) return NextResponse.json({ error: "Checkout attempt not found" }, { status: 404 });
    const offer = await persistence.offers.getOffer(attempt.offerId);
    if (!offer || offer.sessionId !== sessionId || offer.cartFingerprint !== fingerprint) {
      return NextResponse.json({ error: "Checkout no longer matches this cart" }, { status: 409 });
    }
    // Only the server's previously independently verified capture state is success.
    const verified = (attempt.status === "captured" || attempt.status === "reconciled") && Boolean(attempt.providerTransactionId) && attempt.reconciliationStatus === "matched";
    const needsReview = !verified && (
      ["buyer_approved", "capture_pending", "reconciliation_required"].includes(attempt.status) ||
      Boolean(attempt.providerTransactionId) ||
      (attempt.status === "failed" && Boolean(attempt.providerOrderId))
    );
    return NextResponse.json({
      status: verified ? "success" : needsReview ? "review" : "not_completed",
      checkoutStatus: attempt.status,
      ...(verified ? { total: attempt.expectedAmount } : {}),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Invalid status request" : "Payment status unavailable" }, { status: error instanceof z.ZodError ? 400 : 503 });
  }
}
