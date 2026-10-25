import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getPriceIntelligenceService } from "@/lib/server/price-intelligence";
import { createAnonymousSession, SESSION_COOKIE, verifyAnonymousSession } from "@/lib/server/anonymous-session";

const line = z.object({ productId: z.string().min(1).max(80), variantKey: z.string().min(1).max(180), quantity: z.number().int().min(1).max(9) }).strict();
const schema = z.object({ productId: z.string().min(1).max(80).optional(), cart: z.array(line).min(1).max(25) }).strict();
export async function POST(request: Request) {
  try { const input = schema.parse(await request.json()); const cookieStore = await cookies(); const current = verifyAnonymousSession(cookieStore.get(SESSION_COOKIE)?.value); const session = current ? { id: current, token: null } : createAnonymousSession(); const service=getPriceIntelligenceService(); const result=input.productId?await service.compare({productId:input.productId,cart:input.cart,sessionId:session.id}):await service.compareCart({cart:input.cart,sessionId:session.id}); const response = NextResponse.json(result); if (session.token) response.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 }); return response; }
  catch (error) { const message = error instanceof z.ZodError ? "Invalid comparison request" : error instanceof Error ? error.message : "Comparison unavailable"; return NextResponse.json({ error: message }, { status: error instanceof z.ZodError ? 400 : 503 }); }
}
