import { describe,expect,it } from "vitest";
import { postgresPoolConfig, resolvePersistenceBackend } from "./persistence";

describe("persistence configuration",()=>{
  it("allows local development",()=>expect(resolvePersistenceBackend({APP_ENV:"development"})).toBe("local"));
  it("requires PostgreSQL for shared deployment",()=>expect(()=>resolvePersistenceBackend({APP_ENV:"production",PERSISTENCE_BACKEND:"local"})).toThrow("require"));
  it("fails closed without a database URL",()=>expect(()=>resolvePersistenceBackend({APP_ENV:"production",PERSISTENCE_BACKEND:"postgres"})).toThrow("DATABASE_URL"));
  it("accepts configured PostgreSQL",()=>expect(resolvePersistenceBackend({APP_ENV:"production",PERSISTENCE_BACKEND:"postgres",DATABASE_URL:"postgres://example.invalid/db"})).toBe("postgres"));
  it("builds a bounded, low-resource PostgreSQL pool with TLS verification",()=>expect(postgresPoolConfig({DATABASE_URL:"postgres://example.invalid/db"})).toMatchObject({max:3,connectionTimeoutMillis:4500,query_timeout:4000,statement_timeout:4000,idleTimeoutMillis:30000,allowExitOnIdle:true,ssl:{rejectUnauthorized:true}}));
  it("supports explicit timeout overrides without accepting invalid values",()=>expect(postgresPoolConfig({DATABASE_URL:"postgres://example.invalid/db",DATABASE_CONNECT_TIMEOUT_MS:"2500",DATABASE_QUERY_TIMEOUT_MS:"bad",DATABASE_POOL_MAX:"0"})).toMatchObject({max:3,connectionTimeoutMillis:2500,query_timeout:4000}));
  it("requires DATABASE_URL before creating a PostgreSQL pool",()=>expect(()=>postgresPoolConfig({})).toThrow("DATABASE_URL"));
});
