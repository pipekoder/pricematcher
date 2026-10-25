type TokenResponse = { access_token?: string; client_token?: string; error?: string; error_description?: string };

async function paypalJson(url: string, init: RequestInit): Promise<TokenResponse> {
  const response = await fetch(url, init); const value = await response.json() as TokenResponse;
  if (!response.ok) throw new Error(value.error_description ?? value.error ?? "PayPal Sandbox token request failed");
  return value;
}

export async function createPayPalSandboxClientToken(env: Record<string, string|undefined> = process.env) {
  if ((env.PAYPAL_ENVIRONMENT ?? "SANDBOX").toUpperCase() !== "SANDBOX") throw new Error("PriceMatcher only permits PAYPAL_ENVIRONMENT=SANDBOX");
  const clientId = env.PAYPAL_CLIENT_ID; const secret = env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("PayPal Sandbox credentials are not configured");
  const authorization = `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`;
  const oauth = await paypalJson("https://api-m.sandbox.paypal.com/v1/oauth2/token", { method: "POST", headers: { authorization, "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store" });
  if (!oauth.access_token) throw new Error("PayPal Sandbox did not issue an access token");
  const token = await paypalJson("https://api-m.sandbox.paypal.com/v1/identity/generate-token", { method: "POST", headers: { authorization: `Bearer ${oauth.access_token}`, "content-type": "application/x-www-form-urlencoded" }, body: "response_type=client_token", cache: "no-store" });
  if (!token.client_token) throw new Error("PayPal Sandbox did not issue a client token");
  return token.client_token;
}
