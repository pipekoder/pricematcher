import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { TransactionStateError } from "@/lib/payments/transaction-repository";
import { SESSION_COOKIE, verifyAnonymousSession } from "@/lib/server/anonymous-session";
import { getPayPalCheckoutService } from "@/lib/server/paypal";

const schema = z.object({ checkoutAttemptId: z.uuid() }).strict();
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json()); const sessionId = verifyAnonymousSession((await cookies()).get(SESSION_COOKIE)?.value);
    if (!sessionId) return NextResponse.json({ error: "A valid server-issued session is required" }, { status: 401 });
    return NextResponse.json(await getPayPalCheckoutService().captureApprovedOrder(input.checkoutAttemptId, sessionId));
  } catch (error) { const status = error instanceof z.ZodError ? 400 : error instanceof TransactionStateError ? 409 : 503; return NextResponse.json({ error: error instanceof Error ? error.message : "Payment capture unavailable" }, { status }); }
}
