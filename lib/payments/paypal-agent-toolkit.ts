import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import type { Money } from "../types";
import type { PaymentProvider, ProviderError, ProviderResult } from "./provider";

type JsonRecord = Record<string, unknown>;
type ToolkitTool = { execute?: (input: JsonRecord, options?: unknown) => Promise<unknown> };

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
}
function nested(value: unknown, ...keys: string[]): unknown {
  return keys.reduce<unknown>((current, key) => record(current)?.[key], value);
}
function arrayFirst(value: unknown): unknown { return Array.isArray(value) ? value[0] : undefined; }
function moneyFrom(value: unknown): Money | undefined {
  const amount = record(value); const raw = amount?.value; const currency = amount?.currency_code;
  if (currency !== "USD" || (typeof raw !== "string" && typeof raw !== "number")) return;
  const match = String(raw).match(/^(\d+)(?:\.(\d{1,2}))?$/); if (!match) return;
  return { amountMinor: Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")), currency: "USD" };
}
function sameMoney(left: Money, right: Money) { return left.currency === right.currency && left.amountMinor === right.amountMinor; }
function providerError(message: string, retryable = false): ProviderError { return { code: retryable ? "unavailable" : "validation", retryable, message }; }

export class PayPalAgentToolkitProvider implements PaymentProvider {
  readonly provider = "paypal_sandbox" as const;

  constructor(private readonly clientId: string, private readonly clientSecret: string) {
    if (!clientId || !clientSecret) throw new Error("PayPal Sandbox credentials are required");
    this.toolkit();
  }

  private toolkit(requestId?: string) {
    const toolkit = new PayPalAgentToolkit({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      configuration: {
        actions: { orders: { create: true, get: true, capture: true } },
        context: { sandbox: true, ...(requestId ? { request_id: requestId } : {}) },
      },
    });
    const tools = toolkit.getTools() as Record<string, ToolkitTool>;
    const actual = Object.keys(tools).sort(); const expected = ["create_order", "get_order", "pay_order"];
    if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) throw new Error("Unexpected PayPal Agent Toolkit capability set");
    return tools;
  }

  private async run(method: "create_order"|"get_order"|"pay_order", input: JsonRecord, requestId?: string): Promise<ProviderResult<JsonRecord>> {
    try {
      const execute = this.toolkit(requestId)[method]?.execute; if (!execute) return { ok: false, error: providerError(`${method} is unavailable`) };
      const raw = await execute(input, {}); const parsed = typeof raw === "string" ? JSON.parse(raw) : raw; const value = record(parsed);
      const error = record(value?.error); if (!value || error) return { ok: false, error: providerError(String(error?.message ?? `${method} returned an invalid response`), true) };
      return { ok: true, value };
    } catch (error) { return { ok: false, error: providerError(error instanceof Error ? error.message : `${method} failed`, true) }; }
  }

  async createOrder(input: Parameters<PaymentProvider["createOrder"]>[0]) {
    if (input.amount.currency !== "USD" || input.amount.amountMinor < 1) return { ok: false, error: providerError("Only positive USD Sandbox orders are supported") } as const;
    const amount = input.amount.amountMinor / 100;
    const result = await this.run("create_order", { currencyCode: "USD", items: [{ name: "PriceMatcher checkout", description: input.description, quantity: 1, itemCost: amount, itemTotal: amount, taxPercent: 0 }], discount: 0, shippingCost: 0 }, input.idempotencyKey);
    if (!result.ok) return result; const orderId = result.value.id; const status = result.value.status;
    if (typeof orderId !== "string" || typeof status !== "string") return { ok: false, error: providerError("PayPal create_order response is incomplete") } as const;
    return { ok: true, value: { orderId, status } } as const;
  }

  async getOrder(orderId: string) {
    const result = await this.run("get_order", { id: orderId }); if (!result.ok) return result;
    const amount = moneyFrom(nested(arrayFirst(result.value.purchase_units), "amount")); const status = result.value.status;
    if (!amount || typeof status !== "string" || result.value.id !== orderId) return { ok: false, error: providerError("PayPal get_order response is incomplete") } as const;
    return { ok: true, value: { orderId, status, amount } } as const;
  }

  async captureOrder(input: Parameters<PaymentProvider["captureOrder"]>[0]) {
    const result = await this.run("pay_order", { id: input.orderId }, input.idempotencyKey); if (!result.ok) return result;
    const purchase = arrayFirst(result.value.purchase_units); const capture = arrayFirst(nested(purchase, "payments", "captures"));
    const transactionId = record(capture)?.id; const status = record(capture)?.status ?? result.value.status; const amount = moneyFrom(record(capture)?.amount);
    if (typeof transactionId !== "string" || typeof status !== "string" || !amount) return { ok: false, error: providerError("PayPal pay_order response is incomplete") } as const;
    return { ok: true, value: { transactionId, status, amount } } as const;
  }

  async verifyPayment(input: Parameters<PaymentProvider["verifyPayment"]>[0]) {
    const order = await this.getOrder(input.orderId); if (!order.ok) return order;
    return { ok: true, value: { verified: order.value.status === "COMPLETED" && sameMoney(order.value.amount, input.expectedAmount), status: order.value.status } } as const;
  }
}

export function createPayPalSandboxProvider(env: Record<string, string|undefined> = process.env) {
  if ((env.PAYPAL_ENVIRONMENT ?? "SANDBOX").toUpperCase() !== "SANDBOX") throw new Error("PriceMatcher only permits PAYPAL_ENVIRONMENT=SANDBOX");
  return new PayPalAgentToolkitProvider(env.PAYPAL_CLIENT_ID ?? "", env.PAYPAL_CLIENT_SECRET ?? "");
}
