import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createApprovedCheckoutExecutor } from "@/lib/payments/approved-checkout";
import { TransactionStateError } from "@/lib/payments/transaction-repository";
import { OfferValidationError } from "@/lib/persistence/repository";
import { SESSION_COOKIE, verifyAnonymousSession } from "@/lib/server/anonymous-session";
import { getPersistence } from "@/lib/server/persistence";

const line=z.object({productId:z.string().min(1).max(80),variantKey:z.string().min(1).max(180),quantity:z.number().int().min(1).max(9)}).strict();
const schema=z.object({offerId:z.uuid(),cart:z.array(line).min(1).max(25)}).strict();
export async function POST(request:Request){
  try{const {offerId,cart}=schema.parse(await request.json());const sessionId=verifyAnonymousSession((await cookies()).get(SESSION_COOKIE)?.value);if(!sessionId)return NextResponse.json({error:"A valid server-issued session is required"},{status:401});const persistence=getPersistence();const executeApprovedCheckout=createApprovedCheckoutExecutor({offers:persistence.offers,transactions:persistence.transactions});const prepared=await executeApprovedCheckout(offerId,{sessionId,cart,idempotencyKey:randomUUID()});return NextResponse.json({checkoutAttemptId:prepared.checkoutAttemptId,status:"prepared",created:prepared.created},{status:prepared.created?201:200});}
  catch(error){const status=error instanceof z.ZodError?400:error instanceof TransactionStateError||error instanceof OfferValidationError?409:503;return NextResponse.json({error:error instanceof z.ZodError?"Invalid checkout request":error instanceof Error?error.message:"Checkout preparation unavailable",code:error instanceof TransactionStateError||error instanceof OfferValidationError?error.code:error instanceof z.ZodError?"invalid_request":"checkout_unavailable"},{status});}
}
