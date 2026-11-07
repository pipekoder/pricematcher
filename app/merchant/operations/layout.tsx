import { headers } from "next/headers";
import { merchantAccessGranted } from "@/lib/server/merchant-access";

export default async function MerchantOperationsLayout({children}:{children:React.ReactNode}){
  if(!merchantAccessGranted((await headers()).get("authorization")))return <div className="page-shell"><h1>Merchant access required</h1><p>Internal cost and inventory records are not available without merchant credentials.</p></div>;
  return children;
}
