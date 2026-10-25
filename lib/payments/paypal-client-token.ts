type TokenResponse = { access_token?: string; client_token?: string; error?: string; error_description?: string };

export class PayPalTokenError extends Error{constructor(readonly code:string,readonly stage:"oauth"|"client_token"|"configuration",readonly category:string,readonly status?:number){super(stage==="oauth"?"PayPal Sandbox authentication is unavailable.":stage==="client_token"?"PayPal Sandbox checkout initialization is unavailable.":"PayPal Sandbox is not configured.");}}

async function paypalJson(url: string, init: RequestInit,stage:"oauth"|"client_token"): Promise<TokenResponse> {
  const started=Date.now();try{const response = await fetch(url, init);let value:TokenResponse={};try{value=await response.json() as TokenResponse;}catch{}if (!response.ok){const category=response.status===401||response.status===403?"authentication":response.status===429?"rate_limit":response.status>=500?"provider":"request";console.error("paypal_token_failed",{stage,status:response.status,category,elapsedMs:Date.now()-started});throw new PayPalTokenError(`paypal_${stage}_failed`,stage,category,response.status);}console.info("paypal_token_succeeded",{stage,status:response.status,elapsedMs:Date.now()-started});return value;}catch(error){if(error instanceof PayPalTokenError)throw error;console.error("paypal_token_failed",{stage,category:"network",elapsedMs:Date.now()-started});throw new PayPalTokenError(`paypal_${stage}_failed`,stage,"network");}
}

export async function createPayPalSandboxClientToken(env: Record<string, string|undefined> = process.env) {
  if ((env.PAYPAL_ENVIRONMENT ?? "SANDBOX").toUpperCase() !== "SANDBOX") throw new PayPalTokenError("paypal_environment_invalid","configuration","configuration");
  const clientId = env.PAYPAL_CLIENT_ID; const secret = env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new PayPalTokenError("paypal_credentials_missing","configuration","configuration");
  const authorization = `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`;
  const oauth = await paypalJson("https://api-m.sandbox.paypal.com/v1/oauth2/token", { method: "POST", headers: { authorization, "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store" },"oauth");
  if (!oauth.access_token) throw new PayPalTokenError("paypal_oauth_response_invalid","oauth","response");
  const token = await paypalJson("https://api-m.sandbox.paypal.com/v1/identity/generate-token", { method: "POST", headers: { authorization: `Bearer ${oauth.access_token}`, "content-type": "application/x-www-form-urlencoded" }, body: "response_type=client_token", cache: "no-store" },"client_token");
  if (!token.client_token) throw new PayPalTokenError("paypal_client_token_response_invalid","client_token","response");
  return token.client_token;
}
