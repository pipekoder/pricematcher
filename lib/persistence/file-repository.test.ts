import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultPolicy } from "../demo-data";
import { FilePriceIntelligenceRepository } from "./file-repository";

describe("file repository integrity", () => {
  it("round-trips checksummed state", async () => { const dir = await mkdtemp(join(tmpdir(), "pm-repo-")); const path = join(dir, "state.json"); await new FilePriceIntelligenceRepository(path).savePolicy(defaultPolicy); expect((await new FilePriceIntelligenceRepository(path).getPolicy(defaultPolicy.merchantId))?.version).toBe(defaultPolicy.version); });
  it("fails closed repeatedly for corrupt storage", async () => { const dir = await mkdtemp(join(tmpdir(), "pm-repo-")); const path = join(dir, "state.json"); await writeFile(path, "{not-json"); const repo = new FilePriceIntelligenceRepository(path); await expect(repo.getPolicy("north-01")).rejects.toBeInstanceOf(Error); await expect(repo.getPolicy("north-01")).rejects.toBeInstanceOf(Error); });
  it("fails without mutation when another process lock exists", async () => { const dir = await mkdtemp(join(tmpdir(), "pm-repo-")); const path = join(dir, "state.json"); await writeFile(`${path}.lock`, "busy"); const repo = new FilePriceIntelligenceRepository(path); await expect(repo.savePolicy(defaultPolicy)).rejects.toThrow("storage is busy"); expect(repo.policies.size).toBe(0); });
});
