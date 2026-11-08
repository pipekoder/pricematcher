import ledger from "../../docs/CHANNEL3_PR12_REQUEST_LOG.json";
import runningLedger from "../../docs/CHANNEL3_RUNNING_DEMO_LOG.json";

const selectedIds=["wmJLHiy","DoR8Z1M","rkCOGg0","0XxamKL","UkSfHvK","67KJMEr","1Vzvoh1","WKcbW94","RkeTDT2","UkbssSs","25cm4w9","ez4FYFM","vYT9mu8","9EyZwQZ","UVxkCqd","HeNKaf0","GVfeAT0","3auvaOe","grKENhT"] as const;
export type StorefrontPriceReference={productId:string;priceMinor:number;currency:"USD";observedMerchant:string;observedUrl:string;observedAt:string;provider:"channel3_saved"};
export type SavedPriceObservation={domain:string;url:string;price:{price:number;currency:string};availability:string;condition:string};
export function selectSavedPrice(productId:string,observedAt:string,offers:SavedPriceObservation[]):StorefrontPriceReference{
  if(!Number.isFinite(Date.parse(observedAt)))throw new Error(`Missing saved Channel3 retrieval time for ${productId}`);
  const eligible=offers.flatMap(offer=>{
    const value=offer.price.price;
    const minor=Math.round(value*100);
    if(offer.price.currency!=="USD"||offer.availability!=="InStock"||offer.condition!=="new"||!Number.isSafeInteger(minor)||minor<=0||Math.abs(value*100-minor)>0.000001||!offer.domain.trim())return [];
    try {const url=new URL(offer.url);if(url.protocol!=="https:"||!url.hostname)return [];}catch{return [];}
    return [{productId,priceMinor:minor,currency:"USD" as const,observedMerchant:offer.domain,observedUrl:offer.url,observedAt,provider:"channel3_saved" as const}];
  });
  // Lowest eligible observed product price; stable merchant/URL tie-breaks.
  eligible.sort((a,b)=>a.priceMinor-b.priceMinor||a.observedMerchant.localeCompare(b.observedMerchant)||a.observedUrl.localeCompare(b.observedUrl));
  if(!eligible[0])throw new Error(`No eligible saved Channel3 USD price for ${productId}`);
  return eligible[0];
}
export type FootwearSnapshot={id:string;title:string;brand:string;description:string|null;image:string;retrievedAt:string;marketMinor:number;marketDomain:string;sourceUrl:string;priceReference:StorefrontPriceReference;marketOffers:Array<{domain:string;url:string;priceMinor:number}>;attributes:Record<string,string[]|undefined>;selectedVariants:Array<{name:string;label:string}>};
const discovered=[...ledger.requests,...runningLedger.requests].flatMap(request=>request.status==="success"&&request.result?request.result.products.map(product=>({product,retrievedAt:request.result!.retrievedAt})):[]);
export const footwearSnapshots:FootwearSnapshot[]=selectedIds.map(id=>{const found=discovered.find(item=>item.product.id===id);if(!found)throw new Error(`Missing saved Channel3 product ${id}`);const {product,retrievedAt}=found;const image=product.images[0]?.url;if(!image||!image.startsWith("https://"))throw new Error(`No verified product image for ${id}`);const priceReference=selectSavedPrice(id,retrievedAt,product.offers);const marketOffers=product.offers.filter(item=>item.price.currency==="USD"&&item.availability==="InStock"&&item.condition==="new"&&Number.isSafeInteger(Math.round(item.price.price*100))&&item.price.price>0&&Math.abs(item.price.price*100-Math.round(item.price.price*100))<0.000001).map(item=>({domain:item.domain,url:item.url,priceMinor:Math.round(item.price.price*100)})).sort((a,b)=>a.priceMinor-b.priceMinor||a.domain.localeCompare(b.domain)||a.url.localeCompare(b.url));return{id,title:product.title,brand:product.brands[0],description:product.description,image,retrievedAt,marketMinor:priceReference.priceMinor,marketDomain:priceReference.observedMerchant,sourceUrl:priceReference.observedUrl,priceReference,marketOffers,attributes:product.attributes,selectedVariants:product.variants};});
