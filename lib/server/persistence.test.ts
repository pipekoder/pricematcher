import { describe,expect,it } from "vitest";
import { resolvePersistenceBackend } from "./persistence";

describe("persistence configuration",()=>{
  it("allows local development",()=>expect(resolvePersistenceBackend({APP_ENV:"development"})).toBe("local"));
  it("requires PostgreSQL for shared deployment",()=>expect(()=>resolvePersistenceBackend({APP_ENV:"production",PERSISTENCE_BACKEND:"local"})).toThrow("require"));
  it("fails closed without a database URL",()=>expect(()=>resolvePersistenceBackend({APP_ENV:"production",PERSISTENCE_BACKEND:"postgres"})).toThrow("DATABASE_URL"));
  it("accepts configured PostgreSQL",()=>expect(resolvePersistenceBackend({APP_ENV:"production",PERSISTENCE_BACKEND:"postgres",DATABASE_URL:"postgres://example.invalid/db"})).toBe("postgres"));
});
