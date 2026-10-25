import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({getPersistence:vi.fn()}));
vi.mock("../../../lib/server/persistence",()=>({getPersistence:mocks.getPersistence}));
import { GET } from "./route";

describe("GET /api/health",()=>{
  beforeEach(()=>{mocks.getPersistence.mockReset();vi.spyOn(console,"error").mockImplementation(()=>{});delete process.env.DATABASE_HEALTH_TIMEOUT_MS;});
  afterEach(()=>{vi.restoreAllMocks();delete process.env.DATABASE_HEALTH_TIMEOUT_MS;});
  it("returns 200 when PostgreSQL is reachable",async()=>{mocks.getPersistence.mockReturnValue({backend:"postgres",check:async()=>{}});const response=await GET();expect(response.status).toBe(200);expect(await response.json()).toMatchObject({status:"ok",persistence:"postgres"});});
  it.each([
    ["authentication",Object.assign(new Error("password authentication failed for private-user"),{code:"28P01"})],
    ["tls",Object.assign(new Error("private certificate text"),{code:"UNABLE_TO_VERIFY_LEAF_SIGNATURE"})],
    ["network",Object.assign(new Error("connect private-host"),{code:"ECONNREFUSED"})],
  ])("returns a redacted 503 for %s failures",async(category,error)=>{mocks.getPersistence.mockReturnValue({backend:"postgres",check:async()=>{throw error;}});const response=await GET();const text=await response.text();expect(response.status).toBe(503);expect(JSON.parse(text)).toMatchObject({status:"unavailable",category});expect(text).not.toContain("private");expect(console.error).toHaveBeenCalledWith(expect.not.stringContaining("private"));});
  it("returns within its deadline when PostgreSQL hangs",async()=>{process.env.DATABASE_HEALTH_TIMEOUT_MS="20";mocks.getPersistence.mockReturnValue({backend:"postgres",check:()=>new Promise(()=>{})});const started=Date.now();const response=await GET();expect(response.status).toBe(503);expect(await response.json()).toMatchObject({category:"timeout"});expect(Date.now()-started).toBeLessThan(250);});
  it("returns a redacted 503 when DATABASE_URL is missing",async()=>{mocks.getPersistence.mockImplementation(()=>{throw new Error("DATABASE_URL is required for PostgreSQL persistence");});const response=await GET();expect(response.status).toBe(503);expect(await response.json()).toMatchObject({category:"configuration"});});
});
