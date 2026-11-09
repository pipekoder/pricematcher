import type { AcceptedOfferSummary } from "./checkout-summary";

export type BoundCheckoutSummary={offer:AcceptedOfferSummary;cartKey:string;revision:number};

export function checkoutOfferForCart(cartKey:string,revision:number,accepted?:BoundCheckoutSummary,original?:BoundCheckoutSummary){
  const matches=(entry?:BoundCheckoutSummary)=>entry?.cartKey===cartKey&&entry.revision===revision?entry.offer:undefined;
  const acceptedOffer=matches(accepted),originalOffer=matches(original);
  return {acceptedOffer,originalOffer,payableOffer:acceptedOffer??originalOffer};
}
