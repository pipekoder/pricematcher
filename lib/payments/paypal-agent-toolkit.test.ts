import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ configurations: [] as unknown[], execute: vi.fn() }));
vi.mock("@paypal/agent-toolkit/ai-sdk", () => ({
  PayPalAgentToolkit: class {
    constructor(configuration: unknown) { mocks.configurations.push(configuration); }
    getTools() { return Object.fromEntries(["create_order", "get_order", "pay_order"].map((name) => [name, { execute: (input: unknown) => mocks.execute(name, input) }])); }
  },
}));

import { PayPalAgentToolkitProvider } from "./paypal-agent-toolkit";

describe("PayPal Agent Toolkit adapter", () => {
  beforeEach(() => { mocks.configurations.length = 0; mocks.execute.mockReset(); });
  it("restricts tools, forces Sandbox and passes a durable request id", async () => {
    mocks.execute.mockResolvedValue(JSON.stringify({ id: "5O190127TN364715T", status: "CREATED" }));
    const provider = new PayPalAgentToolkitProvider("sandbox-client", "sandbox-secret");
    await expect(provider.createOrder({ checkoutAttemptId: "attempt", idempotencyKey: "request-id", amount: { amountMinor: 13900, currency: "USD" }, intent: "CAPTURE", description: "authorized" })).resolves.toMatchObject({ ok: true, value: { orderId: "5O190127TN364715T" } });
    expect(mocks.configurations.at(-1)).toMatchObject({ configuration: { actions: { orders: { create: true, get: true, capture: true } }, context: { sandbox: true, request_id: "request-id" } } });
    expect(mocks.execute).toHaveBeenCalledWith("create_order", expect.objectContaining({ currencyCode: "USD", items: [expect.objectContaining({ itemCost: 139 })] }));
  });

  it("normalizes approved order and completed capture amounts", async () => {
    mocks.execute.mockImplementation(async (method: string) => JSON.stringify(method === "get_order" ? { id: "5O190127TN364715T", status: "APPROVED", purchase_units: [{ amount: { currency_code: "USD", value: "139.00" } }] } : { status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "8MC585209K746392H", status: "COMPLETED", amount: { currency_code: "USD", value: "139.00" } }] } }] }));
    const provider = new PayPalAgentToolkitProvider("sandbox-client", "sandbox-secret");
    await expect(provider.getOrder("5O190127TN364715T")).resolves.toMatchObject({ ok: true, value: { status: "APPROVED", amount: { amountMinor: 13900 } } });
    await expect(provider.captureOrder({ orderId: "5O190127TN364715T", idempotencyKey: "capture-id" })).resolves.toMatchObject({ ok: true, value: { status: "COMPLETED", amount: { amountMinor: 13900 } } });
  });
});
