import { describe,expect,it,vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OfferCountdown,countdownText,remainingSeconds } from "./offer-countdown";

describe("server-expiry countdown",()=>{
  it("uses absolute expiry rather than resetting on rerender or a suspended tab",()=>{
    vi.useFakeTimers();try{
      vi.setSystemTime(new Date("2026-11-10T10:00:00Z"));const expiry="2026-11-10T10:05:00Z";
      expect(renderToStaticMarkup(<OfferCountdown expiresAt={expiry} onExpired={()=>{}}/>)).toContain("Offer expires in 05:00");
      vi.advanceTimersByTime(125000);expect(countdownText(remainingSeconds(expiry))).toBe("02:55");
      expect(renderToStaticMarkup(<OfferCountdown expiresAt={expiry} onExpired={()=>{}}/>)).toContain("Offer expires in 02:55");
      vi.advanceTimersByTime(180000);expect(remainingSeconds(expiry)).toBe(0);
    }finally{vi.useRealTimers();}
  });
});
