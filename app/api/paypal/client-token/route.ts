import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createPayPalSandboxClientToken, PayPalTokenError } from "@/lib/payments/paypal-client-token";
import { SESSION_COOKIE, verifyAnonymousSession } from "@/lib/server/anonymous-session";

export async function POST() {
  try {
    const sessionId = verifyAnonymousSession((await cookies()).get(SESSION_COOKIE)?.value);
    if (!sessionId) return NextResponse.json({ error: "A valid server-issued session is required" }, { status: 401 });
    return NextResponse.json({ clientToken: await createPayPalSandboxClientToken() }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof PayPalTokenError?error.message:"PayPal Sandbox checkout initialization is unavailable.",code:error instanceof PayPalTokenError?error.code:"paypal_token_unavailable" }, { status: 503 }); }
}
