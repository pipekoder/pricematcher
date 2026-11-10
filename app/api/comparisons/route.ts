import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getPriceIntelligenceService } from "@/lib/server/price-intelligence";
import { DemoOfferService } from "@/lib/price-intelligence/demo-offers";
import { AiOfferService } from "@/lib/ai-offers/service";
import { getPersistence } from "@/lib/server/persistence";
import { OfferValidationError } from "@/lib/persistence/repository";
import { createAnonymousSession, SESSION_COOKIE, verifyAnonymousSession } from "@/lib/server/anonymous-session";
import { progressStages,type ProgressEvent } from "@/lib/ai-offers/progress";

const line = z.object({ productId: z.string().min(1).max(80), variantKey: z.string().min(1).max(180), quantity: z.number().int().min(1).max(9) }).strict();
const schema = z.object({ productId: z.string().min(1).max(80).optional(), cart: z.array(line).min(1).max(25), scenario:z.enum(["MATCH_LOWEST","PARTIAL_MATCH","KEEP_ORIGINAL"]).optional() }).strict();
async function streamFootwearComparison(cart:z.infer<typeof line>[]){
  const cookieStore=await cookies();
  const current=verifyAnonymousSession(cookieStore.get(SESSION_COOKIE)?.value);
  const session=current?{id:current,token:null}:createAnonymousSession();
  let disconnected=false;
  const encoder=new TextEncoder();
  const stream=new ReadableStream<Uint8Array>({
    start(controller){
      const startedAt=performance.now();const statuses=new Map<string,string>();
      const send=(event:string,payload:unknown)=>{if(disconnected)return;try{controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));}catch{disconnected=true;}};
      send("ready",{});
      const heartbeat=setInterval(()=>{if(!disconnected)try{controller.enqueue(encoder.encode(": heartbeat\n\n"));}catch{disconnected=true;}},15000);
      void (async()=>{try{
        const result=await new AiOfferService(getPersistence().offers,undefined,undefined,undefined,progress=>{statuses.set(progress.stage,progress.status);send("progress",progress);}).compare({cart,sessionId:session.id});
        for(const stage of progressStages)if(!["completed","failed","skipped"].includes(statuses.get(stage)??"")){const progress:ProgressEvent={stage,status:"skipped",elapsedMs:Math.round(performance.now()-startedAt)};send("progress",progress);}
        send("result",{...result,offer:result.offer?{id:result.offer.id,finalTotal:result.offer.finalTotal,expiresAt:result.offer.expiresAt}:undefined});
      }catch{send("error",{category:"unavailable"});}finally{clearInterval(heartbeat);if(!disconnected)controller.close();}})();
    },
    cancel(){disconnected=true;},
  });
  const response=new NextResponse(stream,{headers:{"content-type":"text/event-stream; charset=utf-8","cache-control":"no-cache, no-transform","x-accel-buffering":"no"}});
  if(session.token)response.cookies.set(SESSION_COOKIE,session.token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24});
  return response;
}
export async function POST(request: Request) {
  try { const input = schema.parse(await request.json()); if(input.scenario&&input.cart.some(item=>item.productId.startsWith("footwear-")))return NextResponse.json({error:"Scenario selection is unavailable for the footwear store"},{status:400}); if(request.headers.get("accept")?.includes("text/event-stream")&&!input.productId&&!input.scenario&&input.cart.every(item=>item.productId.startsWith("footwear-")))return streamFootwearComparison(input.cart); const cookieStore = await cookies(); const current = verifyAnonymousSession(cookieStore.get(SESSION_COOKIE)?.value); const session = current ? { id: current, token: null } : createAnonymousSession(); const result=input.scenario?await new DemoOfferService(getPersistence().offers).compare({sessionId:session.id,cart:input.cart,scenario:input.scenario}):input.productId?await getPriceIntelligenceService().compare({productId:input.productId,cart:input.cart,sessionId:session.id}):input.cart.every(line=>line.productId.startsWith("footwear-"))?await new AiOfferService(getPersistence().offers).compare({cart:input.cart,sessionId:session.id}):await getPriceIntelligenceService().compareCart({cart:input.cart,sessionId:session.id}); const publicResult = "agentMode" in result ? {...result, offer: result.offer ? {id:result.offer.id,finalTotal:result.offer.finalTotal,expiresAt:result.offer.expiresAt} : undefined} : result; const response = NextResponse.json(publicResult); if (session.token) response.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 }); return response; }
  catch (error) { console.warn(JSON.stringify({event:"comparison_failed",category:error instanceof z.ZodError?"schema":error instanceof OfferValidationError?error.code:"internal"})); const message = error instanceof z.ZodError ? "Invalid comparison request" : error instanceof OfferValidationError ? error.message : "Comparison unavailable"; return NextResponse.json({ error: message }, { status: error instanceof z.ZodError ? 400 : 503 }); }
}
