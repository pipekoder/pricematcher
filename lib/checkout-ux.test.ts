import { describe,expect,it } from "vitest";
import { checkoutOfferForCart,type BoundCheckoutSummary } from "./checkout-ux";
import type { AcceptedOfferSummary } from "./checkout-summary";

const amount=(amountMinor:number)=>({amountMinor,currency:"USD" as const});
const summary=(id:string,total:number):AcceptedOfferSummary=>({offerId:id,originalSubtotal:amount(10000),shipping:amount(0),tax:amount(0),fees:amount(0),originalTotal:amount(10000),savings:amount(10000-total),totalToPay:amount(total),expiresAt:"2099-01-01T00:00:00Z"});
const bound=(offer:AcceptedOfferSummary):BoundCheckoutSummary=>({offer,cartKey:"shoe:1",revision:2});

describe("one-step checkout price selection",()=>{
  const original=bound(summary("original",10000)),accepted=bound(summary("accepted",9000));
  it("pays the original price before any comparison or when a proposal is not accepted",()=>{
    expect(checkoutOfferForCart("shoe:1",2,undefined,original).payableOffer?.offerId).toBe("original");
  });
  it("uses a separately accepted offer only while it belongs to the current cart revision",()=>{
    expect(checkoutOfferForCart("shoe:1",2,accepted,original).payableOffer?.totalToPay.amountMinor).toBe(9000);
    expect(checkoutOfferForCart("shoe:2",2,accepted,{...original,cartKey:"shoe:2"}).payableOffer?.offerId).toBe("original");
    expect(checkoutOfferForCart("shoe:1",3,accepted,{...original,revision:3}).payableOffer?.offerId).toBe("original");
  });
  it("fails closed while a changed cart awaits new original-price authorization",()=>{
    expect(checkoutOfferForCart("shoe:2",3,accepted,original).payableOffer).toBeUndefined();
  });
});
