type ResponseStatus = "completed" | "incomplete" | "failed" | "in_progress" | "queued" | "unknown";
type ContentKind = "output_text" | "text" | "refusal" | "other";

export type SafeResponseMetadata = {
  responseStatus: ResponseStatus;
  incompleteReason: "max_output_tokens" | "content_filter" | "other" | null;
  textSource: "sdk_output_text" | "output_content" | "none";
  textLength: number;
  outputItemCount: number;
  contentKinds: ContentKind[];
};

export class ResponseParseFailure extends Error {
  constructor(readonly category: "response_incomplete" | "response_failed" | "response_refusal" | "empty_output" | "invalid_json", readonly metadata: SafeResponseMetadata) {
    super(category);
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function parseModelResponse(response: unknown): { value: unknown; metadata: SafeResponseMetadata } {
  const root = record(response);
  const status = root?.status;
  const responseStatus: ResponseStatus = status === "completed" || status === "incomplete" || status === "failed" || status === "in_progress" || status === "queued" ? status : "unknown";
  const reason = record(root?.incomplete_details)?.reason;
  const incompleteReason = responseStatus === "incomplete" ? reason === "max_output_tokens" || reason === "content_filter" ? reason : "other" : null;
  const output = Array.isArray(root?.output) ? root.output : [];
  const texts: string[] = [];
  const kinds = new Set<ContentKind>();
  for (const item of output) {
    const message = record(item);
    if (message?.type !== "message" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      const block = record(part);
      const kind: ContentKind = block?.type === "output_text" || block?.type === "text" || block?.type === "refusal" ? block.type : "other";
      kinds.add(kind);
      if ((kind === "output_text" || kind === "text") && typeof block?.text === "string") texts.push(block.text);
    }
  }
  const sdkText = typeof root?.output_text === "string" ? root.output_text : "";
  const text = sdkText.trim() ? sdkText : texts.join("");
  const metadata: SafeResponseMetadata = {
    responseStatus,
    incompleteReason,
    textSource: sdkText.trim() ? "sdk_output_text" : texts.length ? "output_content" : "none",
    textLength: text.length,
    outputItemCount: output.length,
    contentKinds: [...kinds].sort(),
  };
  if (responseStatus === "incomplete" || responseStatus === "in_progress" || responseStatus === "queued") throw new ResponseParseFailure("response_incomplete", metadata);
  if (responseStatus === "failed") throw new ResponseParseFailure("response_failed", metadata);
  if (kinds.has("refusal")) throw new ResponseParseFailure("response_refusal", metadata);
  if (!text.trim()) throw new ResponseParseFailure("empty_output", metadata);
  try { return { value: JSON.parse(text), metadata }; }
  catch { throw new ResponseParseFailure("invalid_json", metadata); }
}
