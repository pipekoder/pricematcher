import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  constructorOptions: null as Record<string, unknown> | null,
  create: vi.fn(),
}));

vi.mock("openai", async (importOriginal) => ({
  ...await importOriginal<typeof import("openai")>(),
  default: class {
    responses = { create: mock.create };
    constructor(options: Record<string, unknown>) { mock.constructorOptions = options; }
  },
}));

import { META_MODEL_API_BASE_URL, MODEL_MAX_OUTPUT_TOKENS, MUSE_SPARK_MODEL, MuseSparkResponseModel, schemas, strategistSchema } from "./model";
import { APIConnectionError, APIConnectionTimeoutError } from "openai";

const oldKey = process.env.MODEL_API_KEY;
afterEach(() => {
  if (oldKey === undefined) delete process.env.MODEL_API_KEY;
  else process.env.MODEL_API_KEY = oldKey;
  mock.create.mockReset();
});

describe("Meta Model API transport", () => {
  it("matches Agent A JSON Schema bounds to the strict Zod validator", () => {
    const sent = schemas["inventory-sales"] as { properties: { items: { minItems: number; maxItems: number; items: { properties: Record<string,Record<string,unknown>> } } } };
    const item = sent.properties.items.items.properties;
    expect(schemas["inventory-sales"]).toMatchObject({ type: "object", additionalProperties: false, required: ["items"] });
    expect(schemas["inventory-sales"]).not.toHaveProperty("$schema");
    expect(sent.properties.items).toMatchObject({ minItems: 1, maxItems: 25 });
    for (const field of ["minSuggestedMinor", "maxSuggestedMinor"]) expect(item[field]).toMatchObject({ type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
    expect(item.reasons).toMatchObject({ type: "string", maxLength: 240 });
    expect(item.riskFlags).toMatchObject({ type: "array", maxItems: 5, items: { type: "string", maxLength: 240 } });
    expect(strategistSchema.safeParse({ items: [{ key: "test", classification: "healthy", demandTrend: "steady", aggressiveness: "moderate", minSuggestedMinor: 0, maxSuggestedMinor: 0, reasons: "short", riskFlags: [] }] }).success).toBe(true);
  });
  it("requires a Meta key and ignores a legacy OpenAI key", () => {
    delete process.env.MODEL_API_KEY;
    expect(() => new MuseSparkResponseModel()).toThrow("meta_model_api_unconfigured");
  });

  it("sends strict JSON requests to Muse Spark without retries or storage", async () => {
    process.env.MODEL_API_KEY = "test-only-meta-key";
    mock.create.mockResolvedValue({ output_text: '{"items":[]}', usage: { input_tokens: 1, output_tokens: 1 } });
    const model = new MuseSparkResponseModel();
    expect(mock.constructorOptions).toMatchObject({ baseURL: META_MODEL_API_BASE_URL, apiKey: "test-only-meta-key", maxRetries: 0, timeout: 40000 });
    expect(await model.run("inventory-sales", { items: [] })).toEqual({ items: [] });
    expect(mock.create).toHaveBeenCalledOnce();
    expect(mock.create.mock.calls[0][0]).toMatchObject({ model: MUSE_SPARK_MODEL, store: false, max_output_tokens: MODEL_MAX_OUTPUT_TOKENS, reasoning: { effort: "low" }, text: { format: { type: "json_schema", strict: true } } });
    expect(mock.create.mock.calls[0][1]).toMatchObject({ maxRetries: 0, timeout: 40000 });
  });

  it.each([
    ["APIError", 401, "authentication"],
    ["APIError", 429, "rate_limit"],
  ])("classifies %s failures without logging error text", async (name, status, category) => {
    process.env.MODEL_API_KEY = "sensitive-test-key";
    const error = Object.assign(new Error("sensitive-error-message"), { name, status, cause: name === "APIConnectionError" ? { code: "ENOTFOUND" } : undefined });
    mock.create.mockRejectedValue(error);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(new MuseSparkResponseModel().run("inventory-sales", { items: [] })).rejects.toBe(error);
      const event = JSON.parse(String(warn.mock.calls.at(-1)?.[0]));
      expect(event).toMatchObject({ event: "ai_offer_model_failure", agent: "inventory-sales", stage: "request", category, errorType: name, nearDeadline: false });
      if(name === "APIConnectionError")expect(event.networkCode).toBe("ENOTFOUND");
      expect(JSON.stringify(event)).not.toMatch(/sensitive-test-key|sensitive-error-message/);
    } finally { warn.mockRestore(); }
  });

  it("recognizes actual SDK timeout and transport classes even though name is Error", async () => {
    process.env.MODEL_API_KEY = "sensitive-test-key";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      for (const [error, category, errorType] of [
        [new APIConnectionTimeoutError(), "timeout", "APIConnectionTimeoutError"],
        [new APIConnectionError({ message: "sensitive-transport-detail" }), "connection", "APIConnectionError"],
      ] as const) {
        expect(error.name).toBe("Error");
        mock.create.mockRejectedValueOnce(error);
        await expect(new MuseSparkResponseModel().run("inventory-sales", { items: [] })).rejects.toBe(error);
        const event = JSON.parse(String(warn.mock.calls.at(-1)?.[0]));
        expect(event).toMatchObject({ stage: "request", category, errorType });
        expect(JSON.stringify(event)).not.toMatch(/sensitive-test-key|sensitive-transport-detail/);
      }
    } finally { warn.mockRestore(); }
  });

  it("classifies malformed model output separately from network errors", async () => {
    process.env.MODEL_API_KEY = "sensitive-test-key";
    mock.create.mockResolvedValue({ output_text: "not-json" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(new MuseSparkResponseModel().run("inventory-sales", { items: [] })).rejects.toThrow();
      expect(JSON.parse(String(warn.mock.calls.at(-1)?.[0]))).toMatchObject({ event: "ai_offer_model_failure", stage: "response_parse", category: "invalid_json", response: { textSource: "sdk_output_text", textLength: 8 } });
    } finally { warn.mockRestore(); }
  });

  it("logs token counts but no response content when output is truncated", async () => {
    process.env.MODEL_API_KEY = "sensitive-test-key";
    mock.create.mockResolvedValue({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [{ type: "reasoning" }], usage: { input_tokens: 500, output_tokens: MODEL_MAX_OUTPUT_TOKENS, output_tokens_details: { reasoning_tokens: 3900 } } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(new MuseSparkResponseModel().run("inventory-sales", { items: [] })).rejects.toThrow("response_incomplete");
      const event = JSON.parse(String(warn.mock.calls.at(-1)?.[0]));
      expect(event).toMatchObject({ event: "ai_offer_model_failure", category: "response_incomplete", outputTokenLimit: MODEL_MAX_OUTPUT_TOKENS, response: { incompleteReason: "max_output_tokens", inputTokens: 500, outputTokens: MODEL_MAX_OUTPUT_TOKENS, reasoningTokens: 3900 } });
      expect(JSON.stringify(event)).not.toContain("sensitive-test-key");
    } finally { warn.mockRestore(); }
  });
});
