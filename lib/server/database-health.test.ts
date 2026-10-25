import { describe, expect, it } from "vitest";
import { checkDatabaseHealth, classifyDatabaseError } from "./database-health";

describe("database health diagnostics",()=>{
  it("reports a successful PostgreSQL check",async()=>expect(await checkDatabaseHealth(async()=>{},50)).toMatchObject({ok:true}));
  it("bounds a hanging database connection",async()=>{const started=Date.now();const result=await checkDatabaseHealth(()=>new Promise(()=>{}),20);expect(result).toMatchObject({ok:false,category:"timeout"});expect(Date.now()-started).toBeLessThan(250);});
  it("classifies invalid credentials without returning the error text",()=>expect(classifyDatabaseError(Object.assign(new Error("password authentication failed for user secret-user"),{code:"28P01"}))).toBe("authentication"));
  it("classifies TLS certificate failures",()=>expect(classifyDatabaseError(Object.assign(new Error("certificate details"),{code:"UNABLE_TO_VERIFY_LEAF_SIGNATURE"}))).toBe("tls"));
  it("classifies unavailable TCP and DNS endpoints",()=>{expect(classifyDatabaseError(Object.assign(new Error("refused"),{code:"ECONNREFUSED"}))).toBe("network");expect(classifyDatabaseError(Object.assign(new Error("dns"),{code:"ENOTFOUND"}))).toBe("dns");});
  it("classifies missing database configuration",()=>expect(classifyDatabaseError(new Error("DATABASE_URL is required for PostgreSQL persistence"))).toBe("configuration"));
});
