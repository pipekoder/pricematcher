"use client";

import { loadCoreSdkScript } from "@paypal/paypal-js/sdk-v6";
import { useState } from "react";
import { invalidatesAuthorizedOffer } from "@/lib/checkout-summary";
import type { CartItemInput } from "@/lib/types";

class CheckoutApiError extends Error { constructor(message: string, readonly code?: string) { super(message); } }

async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json();
  if (!response.ok) throw new CheckoutApiError(value.error ?? "PayPal Sandbox request failed", value.code);
  return value as T;
}

export function PayPalCheckout({ offerId, cart, onOfferInvalidated, onAttemptCreated, onPaymentVerified, onPaymentUncertain, authorizationLoading=false, priceMode="original" }: { offerId?: string; cart: CartItemInput[]; onOfferInvalidated?: (reason: "expired" | "invalid") => void; onAttemptCreated?: (attemptId: string) => void; onPaymentVerified?: () => void; onPaymentUncertain?: () => void; authorizationLoading?:boolean;priceMode?:"original"|"accepted" }) {
  const [state, setState] = useState<"idle"|"loading"|"success"|"failed"|"canceled"|"uncertain">("idle");
  const [message, setMessage] = useState("");
  async function pay() {
    if (!offerId || state === "loading") return;
    setState("loading"); setMessage("Preparing your authorized checkout…");
    let orderRequested = false;
    try {
      const prepared = await post<{ checkoutAttemptId: string }>("/api/checkout/prepare", { offerId, cart });
      onAttemptCreated?.(prepared.checkoutAttemptId);
      const config = await post<{ clientId: string; environment:"sandbox" }>("/api/paypal/sdk-config");
      const paypal = await loadCoreSdkScript({ environment: "sandbox" }); if (!paypal) throw new Error("PayPal Sandbox SDK could not load");
      const sdk = await paypal.createInstance({ clientId: config.clientId, components: ["paypal-payments"], locale: "en-US", pageType: "checkout" });
      const eligibility = await sdk.findEligibleMethods(); if (!eligibility.isEligible("paypal")) throw new Error("PayPal is not eligible for this Sandbox session");
      orderRequested = true;
      const order = await post<{ orderId: string }>("/api/paypal/orders", { checkoutAttemptId: prepared.checkoutAttemptId });
      let approvalReceived = false;
      const uncertainMessage = "Payment status needs review. Do not retry this order until its PayPal Sandbox status is confirmed.";
      const session = sdk.createPayPalOneTimePaymentSession({
        onApprove: async () => { approvalReceived = true; setMessage("Verifying and capturing the approved Sandbox payment…"); try { const result = await post<{ verified: boolean }>("/api/paypal/capture", { checkoutAttemptId: prepared.checkoutAttemptId }); if (!result.verified) throw new Error("PayPal payment was not verified"); setState("success"); setMessage("Payment verified in PayPal Sandbox."); onPaymentVerified?.(); } catch { setState("uncertain"); setMessage(uncertainMessage); onPaymentUncertain?.(); } },
        onCancel: () => { setState(approvalReceived ? "uncertain" : "canceled"); setMessage(approvalReceived ? uncertainMessage : "PayPal approval was canceled. No capture was requested."); if(approvalReceived) onPaymentUncertain?.(); },
        onError: () => { setState(approvalReceived ? "uncertain" : "failed"); setMessage(approvalReceived ? uncertainMessage : "PayPal Sandbox could not complete the approval flow."); if(approvalReceived) onPaymentUncertain?.(); },
      });
      await session.start({ presentationMode: "popup" }, Promise.resolve({ orderId: order.orderId }));
    } catch (error) {
      if (error instanceof CheckoutApiError && invalidatesAuthorizedOffer(error.code)) {
        setState("failed"); setMessage("The authorized price is no longer valid. Checkout is refreshing the original price.");
        onOfferInvalidated?.(error.code === "expired" || error.code === "stale_evidence" ? "expired" : "invalid");
        return;
      }
      if (orderRequested) { setState("uncertain"); setMessage("Payment status needs review. Do not retry until the PayPal Sandbox status is confirmed."); onPaymentUncertain?.(); }
      else { setState("failed"); setMessage(error instanceof Error ? error.message : "PayPal Sandbox checkout failed before order creation"); }
    }
  }

  return <div className="payment-disabled" aria-live="polite"><p>{offerId?priceMode==="accepted"?"Your accepted Deal Engine offer is server-authorized. PayPal will request separate buyer approval.":"Your original SOLE price is server-authorized. No price check is required.":authorizationLoading?"Preparing secure original-price checkout…":"Payment is temporarily unavailable until the server authorizes your cart."}</p><button type="button" className="button primary large" disabled={!offerId||state==="loading"||state==="success"||state==="uncertain"} onClick={pay}>{state==="loading"?"Loading PayPal Sandbox…":state==="success"?"Sandbox payment verified":state==="uncertain"?"Payment status needs review":"Continue with PayPal Sandbox"}</button>{message&&<p role={state==="failed"||state==="uncertain"?"alert":"status"}>{message}</p>}<small>Sandbox only · No live payment credentials or real money</small></div>;
}
