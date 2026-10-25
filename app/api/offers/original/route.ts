import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptedOfferSummary } from "@/lib/checkout-summary";
import { OfferValidationError } from "@/lib/persistence/repository";
import { createAnonymousSession, SESSION_COOKIE, verifyAnonymousSession } from "@/lib/server/anonymous-session";
import { getPriceIntelligenceService } from "@/lib/server/price-intelligence";

const line=z.object({productId:z.string().min(1).max(80),variantKey:z.string().min(1).max(180),quantity:z.number().int().min(1).max(9)}).strict();
const schema=z.object({cart:z.array(line).min(1).max(25)}).strict();
export async function POST(request:Request){try{const{cart}=schema.parse(await request.json());const cookieStore=await cookies();const current=verifyAnonymousSession(cookieStore.get(SESSION_COOKIE)?.value);const session=current?{id:current,token:null}:createAnonymousSession();const accepted=await getPriceIntelligenceService().authorizeOriginalCart({sessionId:session.id,cart});const offer=accepted.offer;const response=NextResponse.json({offerId:offer.id,status:offer.status,summary:acceptedOfferSummary({offerId:offer.id,originalSubtotal:offer.cartSnapshot.subtotal,shipping:offer.cartSnapshot.shipping,tax:offer.cartSnapshot.tax,fees:offer.cartSnapshot.fees,totalToPay:offer.finalTotal,expiresAt:offer.expiresAt})},{status:201});if(session.token)response.cookies.set(SESSION_COOKIE,session.token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24});return response;}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Original-price checkout unavailable",code:error instanceof OfferValidationError?error.code:"invalid_request"},{status:error instanceof z.ZodError?400:409});}}
