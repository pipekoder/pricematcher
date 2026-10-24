import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createApprovedCheckoutExecutor } from "@/lib/payments/approved-checkout";
import { TransactionStateError } from "@/lib/payments/transaction-repository";
import { SESSION_COOKIE, verifyAnonymousSession } from "@/lib/server/anonymous-session";
import { getPersistence } from "@/lib/server/persistence";

const schema=z.object({offerId:z.uuid()}).strict();
export async function POST(request:Request){
  try{const {offerId}=schema.parse(await request.json());const sessionId=verifyAnonymousSession((await cookies()).get(SESSION_COOKIE)?.value);if(!sessionId)return NextResponse.json({error:"A valid server-issued session is required"},{status:401});const persistence=getPersistence();const offer=await persistence.offers.getOffer(offerId);if(!offer||offer.sessionId!==sessionId)return NextResponse.json({error:"Offer not found"},{status:404});const executeApprovedCheckout=createApprovedCheckoutExecutor({offers:persistence.offers,transactions:persistence.transactions});const prepared=await executeApprovedCheckout(offerId,{sessionId,cartFingerprint:offer.cartFingerprint,idempotencyKey:randomUUID()});return NextResponse.json(prepared,{status:prepared.created?201:200});}
  catch(error){const status=error instanceof z.ZodError?400:error instanceof TransactionStateError?409:503;return NextResponse.json({error:error instanceof z.ZodError?"Invalid checkout request":error instanceof Error?error.message:"Checkout preparation unavailable"},{status});}
}
