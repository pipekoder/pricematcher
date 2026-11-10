import { describe,expect,it,vi } from "vitest";
import { readComparisonStream } from "./progress-client";

function stream(chunks:string[]){return new Response(new ReadableStream({start(controller){for(const chunk of chunks)controller.enqueue(new TextEncoder().encode(chunk));controller.close();}}),{status:200});}
describe("comparison progress stream",()=>{
  it("reports only backend events and returns a single result across chunk boundaries",async()=>{
    const onProgress=vi.fn();const response=stream(["event: ready\ndata: {}\n\nevent: progress\ndata: {\"stage\":\"agent-a\",\"status\":\"running\",\"elapsedMs\":0}\n\nevent: res","ult\ndata: {\"agentMode\":\"ai\"}\n\n"]);
    await expect(readComparisonStream(response,onProgress)).resolves.toEqual({agentMode:"ai"});
    expect(onProgress).toHaveBeenCalledTimes(1);expect(onProgress).toHaveBeenCalledWith({stage:"agent-a",status:"running",elapsedMs:0});
  });
  it("fails closed on disconnect, malformed success or server error without issuing another request",async()=>{
    await expect(readComparisonStream(stream(["event: ready\ndata: {}\n\n"]),vi.fn())).rejects.toThrow("comparison_interrupted");
    await expect(readComparisonStream(stream(["event: error\ndata: {\"category\":\"unavailable\"}\n\n"]),vi.fn())).rejects.toThrow("comparison_failed");
  });
});
