import { describe, expect, it } from "vitest";
import { parseModelResponse, ResponseParseFailure } from "./response-parser";

describe("Meta Responses parsing", () => {
  it("accepts the SDK's output_text", () => {
    expect(parseModelResponse({ status: "completed", output_text: '{"items":[]}' })).toMatchObject({
      value: { items: [] }, metadata: { responseStatus: "completed", textSource: "sdk_output_text", textLength: 12 },
    });
  });

  it("accepts standard output message text when the SDK aggregate is empty", () => {
    const response = { status: "completed", output_text: "", output: [{ type: "message", content: [{ type: "output_text", text: '{"items":[]}' }] }] };
    expect(parseModelResponse(response)).toMatchObject({ value: { items: [] }, metadata: { textSource: "output_content", contentKinds: ["output_text"] } });
  });

  it("accepts compatible text content blocks without accepting arbitrary fields", () => {
    const response = { status: "completed", output: [{ type: "message", content: [{ type: "text", text: '{"items":[]}' }] }] };
    expect(parseModelResponse(response)).toMatchObject({ value: { items: [] }, metadata: { textSource: "output_content", contentKinds: ["text"] } });
  });

  it("fails closed on incomplete responses, refusals and empty output", () => {
    const cases = [
      [{ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output_text: '{"items":[]}', usage: { input_tokens: 100, output_tokens: 1400, output_tokens_details: { reasoning_tokens: 1400 } } }, "response_incomplete"],
      [{ status: "in_progress", output_text: '{"items":[]}' }, "response_incomplete"],
      [{ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "secret refusal text" }] }] }, "response_refusal"],
      [{ status: "completed", output_text: "" }, "empty_output"],
    ] as const;
    for (const [response, category] of cases) {
      try { parseModelResponse(response); throw new Error("Expected parsing to fail"); }
      catch (error) {
        expect(error).toBeInstanceOf(ResponseParseFailure);
        expect((error as ResponseParseFailure).category).toBe(category);
        expect(JSON.stringify((error as ResponseParseFailure).metadata)).not.toContain("secret refusal text");
      }
    }
  });

  it("classifies non-JSON text without recording it", () => {
    try { parseModelResponse({ status: "completed", output_text: "secret non-json output" }); throw new Error("Expected parsing to fail"); }
    catch (error) {
      expect(error).toBeInstanceOf(ResponseParseFailure);
      expect((error as ResponseParseFailure).category).toBe("invalid_json");
      expect(JSON.stringify((error as ResponseParseFailure).metadata)).not.toContain("secret non-json output");
    }
  });
});
