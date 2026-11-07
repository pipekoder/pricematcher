import { NextResponse, type NextRequest } from "next/server";
import { merchantAccessGranted } from "./lib/server/merchant-access";

export function proxy(request:NextRequest){
  if(!merchantAccessGranted(request.headers.get("authorization")))return new NextResponse("Merchant access required",{status:401,headers:{"WWW-Authenticate":"Basic realm=\"PriceMatcher Merchant Demo\"","Cache-Control":"no-store"}});
  return NextResponse.next();
}
export const config={matcher:["/merchant/operations/:path*"]};
