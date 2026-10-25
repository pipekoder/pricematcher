import { afterEach, describe, expect, it, vi } from "vitest";
import { createPayPalSandboxClientToken } from "./paypal-client-token";

describe("PayPal v6 client token", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uses only Sandbox token endpoints and returns only the browser-safe client token", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "server-oauth" }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ client_token: "browser-client-token" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(createPayPalSandboxClientToken({ PAYPAL_ENVIRONMENT: "SANDBOX", PAYPAL_CLIENT_ID: "sandbox-id", PAYPAL_CLIENT_SECRET: "sandbox-secret" })).resolves.toBe("browser-client-token");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["https://api-m.sandbox.paypal.com/v1/oauth2/token", "https://api-m.sandbox.paypal.com/v1/identity/generate-token"]);
  });
  it("fails closed for Live configuration", async () => {
    await expect(createPayPalSandboxClientToken({ PAYPAL_ENVIRONMENT: "PRODUCTION", PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: "secret" })).rejects.toThrow("only permits");
  });
});
