import { afterEach,describe,expect,it } from "vitest";
import { merchantAccessGranted } from "./merchant-access";
const prior=process.env.MERCHANT_DEMO_ACCESS_TOKEN;
afterEach(()=>{if(prior===undefined)delete process.env.MERCHANT_DEMO_ACCESS_TOKEN;else process.env.MERCHANT_DEMO_ACCESS_TOKEN=prior;});
describe("merchant diagnostics access",()=>{
  it("fails closed without a configured secret",()=>{delete process.env.MERCHANT_DEMO_ACCESS_TOKEN;expect(merchantAccessGranted(null)).toBe(false);});
  it("requires the exact merchant credential",()=>{process.env.MERCHANT_DEMO_ACCESS_TOKEN="merchant-demo-long-private-token";const header=(password:string)=>`Basic ${Buffer.from(`merchant:${password}`).toString("base64")}`;expect(merchantAccessGranted(header("merchant-demo-long-private-token"))).toBe(true);expect(merchantAccessGranted(header("wrong"))).toBe(false);});
});
