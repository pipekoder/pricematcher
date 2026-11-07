import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getPriceIntelligenceService } from "@/lib/server/price-intelligence";
import { DemoOfferService } from "@/lib/price-intelligence/demo-offers";
import { AiOfferService } from "@/lib/ai-offers/service";
import { getPersistence } from "@/lib/server/persistence";
import { OfferValidationError } from "@/lib/persistence/repository";
import { createAnonymousSession, SESSION_COOKIE, verifyAnonymousSession } from "@/lib/server/anonymous-session";

const line = z.object({ productId: z.string().min(1).max(80), variantKey: z.string().min(1).max(180), quantity: z.number().int().min(1).max(9) }).strict();
const schema = z.object({ productId: z.string().min(1).max(80).optional(), cart: z.array(line).min(1).max(25), scenario:z.enum(["MATCH_LOWEST","PARTIAL_MATCH","KEEP_ORIGINAL"]).optional() }).strict();
export async function POST(request: Request) {
  try { const input = schema.parse(await request.json()); if(input.scenario&&input.cart.some(item=>item.productId.startsWith("footwear-")))return NextResponse.json({error:"Scenario selection is unavailable for the footwear store"},{status:400}); const cookieStore = await cookies(); const current = verifyAnonymousSession(cookieStore.get(SESSION_COOKIE)?.value); const session = current ? { id: current, token: null } : createAnonymousSession(); const result=input.scenario?await new DemoOfferService(getPersistence().offers).compare({sessionId:session.id,cart:input.cart,scenario:input.scenario}):input.productId?await getPriceIntelligenceService().compare({productId:input.productId,cart:input.cart,sessionId:session.id}):input.cart.every(line=>line.productId.startsWith("footwear-"))?await new AiOfferService(getPersistence().offers).compare({cart:input.cart,sessionId:session.id}):await getPriceIntelligenceService().compareCart({cart:input.cart,sessionId:session.id}); const publicResult = "agentMode" in result ? {...result, offer: result.offer ? {id:result.offer.id,finalTotal:result.offer.finalTotal,expiresAt:result.offer.expiresAt} : undefined} : result; const response = NextResponse.json(publicResult); if (session.token) response.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 }); return response; }
  catch (error) { console.warn(JSON.stringify({event:"comparison_failed",category:error instanceof z.ZodError?"schema":error instanceof OfferValidationError?error.code:"internal"})); const message = error instanceof z.ZodError ? "Invalid comparison request" : error instanceof OfferValidationError ? error.message : "Comparison unavailable"; return NextResponse.json({ error: message }, { status: error instanceof z.ZodError ? 400 : 503 }); }
}
