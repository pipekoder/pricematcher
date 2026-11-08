import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  constructorOptions: null as Record<string, unknown> | null,
  create: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class {
    responses = { create: mock.create };
    constructor(options: Record<string, unknown>) { mock.constructorOptions = options; }
  },
}));

import { META_MODEL_API_BASE_URL, MUSE_SPARK_MODEL, MuseSparkResponseModel } from "./model";

const oldKey = process.env.MODEL_API_KEY;
afterEach(() => {
  if (oldKey === undefined) delete process.env.MODEL_API_KEY;
  else process.env.MODEL_API_KEY = oldKey;
  mock.create.mockReset();
});

describe("Meta Model API transport", () => {
  it("requires a Meta key and ignores a legacy OpenAI key", () => {
    delete process.env.MODEL_API_KEY;
    expect(() => new MuseSparkResponseModel()).toThrow("meta_model_api_unconfigured");
  });

  it("sends strict JSON requests to Muse Spark without retries or storage", async () => {
    process.env.MODEL_API_KEY = "test-only-meta-key";
    mock.create.mockResolvedValue({ output_text: '{"items":[]}', usage: { input_tokens: 1, output_tokens: 1 } });
    const model = new MuseSparkResponseModel();
    expect(mock.constructorOptions).toMatchObject({ baseURL: META_MODEL_API_BASE_URL, apiKey: "test-only-meta-key", maxRetries: 0, timeout: 20000 });
    expect(await model.run("inventory-sales", { items: [] })).toEqual({ items: [] });
    expect(mock.create).toHaveBeenCalledOnce();
    expect(mock.create.mock.calls[0][0]).toMatchObject({ model: MUSE_SPARK_MODEL, store: false, text: { format: { type: "json_schema", strict: true } } });
    expect(mock.create.mock.calls[0][1]).toMatchObject({ maxRetries: 0, timeout: 20000 });
  });

  it.each([
    ["APIConnectionTimeoutError", undefined, "timeout"],
    ["APIConnectionError", undefined, "connection"],
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
      expect(event).toMatchObject({ event: "ai_offer_model_failure", agent: "inventory-sales", stage: "request", category });
      if(name === "APIConnectionError")expect(event.networkCode).toBe("ENOTFOUND");
      expect(JSON.stringify(event)).not.toMatch(/sensitive-test-key|sensitive-error-message/);
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
});
