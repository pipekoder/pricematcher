"use client";
import { useState } from "react";
import { loadCoreSdkScript } from "@paypal/paypal-js/sdk-v6";
import type { CartItemInput } from "@/lib/types";

async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json(); if (!response.ok) throw new Error(value.error ?? "PayPal Sandbox request failed"); return value as T;
}

export function PayPalCheckout({ offerId, cart }: { offerId?: string; cart: CartItemInput[] }) {
  const [state, setState] = useState<"idle"|"loading"|"success"|"failed"|"canceled">("idle");
  const [message, setMessage] = useState("");
  async function pay() {
    if (!offerId || state === "loading") return; setState("loading"); setMessage("Preparing your authorized checkout…");
    try {
      const prepared = await post<{ checkoutAttemptId: string }>("/api/checkout/prepare", { offerId, cart });
      const token = await post<{ clientToken: string }>("/api/paypal/client-token");
      const paypal = await loadCoreSdkScript({ environment: "sandbox" }); if (!paypal) throw new Error("PayPal Sandbox SDK could not load");
      const sdk = await paypal.createInstance({ clientToken: token.clientToken, components: ["paypal-payments"], locale: "en-US", pageType: "checkout" });
      const eligibility = await sdk.findEligibleMethods(); if (!eligibility.isEligible("paypal")) throw new Error("PayPal is not eligible for this Sandbox session");
      const order = await post<{ orderId: string }>("/api/paypal/orders", { checkoutAttemptId: prepared.checkoutAttemptId });
      const session = sdk.createPayPalOneTimePaymentSession({
        onApprove: async () => { setMessage("Verifying and capturing the approved Sandbox payment…"); const result = await post<{ verified: boolean }>("/api/paypal/capture", { checkoutAttemptId: prepared.checkoutAttemptId }); if (!result.verified) throw new Error("PayPal payment was not verified"); setState("success"); setMessage("Payment verified in PayPal Sandbox."); },
        onCancel: () => { setState("canceled"); setMessage("PayPal approval was canceled. No capture was requested."); },
        onError: () => { setState("failed"); setMessage("PayPal Sandbox could not complete the approval flow."); },
      });
      await session.start({ presentationMode: "popup" }, Promise.resolve({ orderId: order.orderId }));
    } catch (error) { setState("failed"); setMessage(error instanceof Error ? error.message : "PayPal Sandbox checkout failed"); }
  }
  return <div className="payment-disabled" aria-live="polite"><strong>PayPal Sandbox checkout</strong><p>{offerId ? "Your accepted server-authorized total is ready. PayPal will ask for explicit buyer approval before capture." : "Accept an eligible PriceMatcher offer to enable PayPal Sandbox."}</p><button className="button primary large" disabled={!offerId || state === "loading" || state === "success"} onClick={pay}>{state === "loading" ? "Opening PayPal Sandbox…" : state === "success" ? "Sandbox payment verified" : "Continue with PayPal Sandbox"}</button>{message && <p role={state === "failed" ? "alert" : "status"}>{message}</p>}<small>Sandbox only · No live payment credentials or real money</small></div>;
}
