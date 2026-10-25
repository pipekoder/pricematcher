import { describe,expect,it } from "vitest";
import { effectivePostgresSsl, postgresPoolConfig, resolvePersistenceBackend } from "./persistence";

const ca="-----BEGIN CERTIFICATE-----\nZGVtby1jYQ==\n-----END CERTIFICATE-----\n";

describe("persistence configuration",()=>{
  it("allows local development",()=>expect(resolvePersistenceBackend({APP_ENV:"development"})).toBe("local"));
  it("requires PostgreSQL for shared deployment",()=>expect(()=>resolvePersistenceBackend({APP_ENV:"production",PERSISTENCE_BACKEND:"local"})).toThrow("require"));
  it("fails closed without a database URL",()=>expect(()=>resolvePersistenceBackend({APP_ENV:"production",PERSISTENCE_BACKEND:"postgres"})).toThrow("DATABASE_URL"));
  it("accepts configured PostgreSQL",()=>expect(resolvePersistenceBackend({APP_ENV:"production",PERSISTENCE_BACKEND:"postgres",DATABASE_URL:"postgres://example.invalid/db"})).toBe("postgres"));
  it("builds a bounded, low-resource PostgreSQL pool with TLS verification",()=>expect(postgresPoolConfig({DATABASE_URL:"postgres://example.invalid/db"})).toMatchObject({max:3,connectionTimeoutMillis:4500,query_timeout:4000,statement_timeout:4000,idleTimeoutMillis:30000,allowExitOnIdle:true,ssl:{rejectUnauthorized:true}}));
  it("supports explicit timeout overrides without accepting invalid values",()=>expect(postgresPoolConfig({DATABASE_URL:"postgres://example.invalid/db",DATABASE_CONNECT_TIMEOUT_MS:"2500",DATABASE_QUERY_TIMEOUT_MS:"bad",DATABASE_POOL_MAX:"0"})).toMatchObject({max:3,connectionTimeoutMillis:2500,query_timeout:4000}));
  it("requires DATABASE_URL before creating a PostgreSQL pool",()=>expect(()=>postgresPoolConfig({})).toThrow("DATABASE_URL"));
  it("prevents DATABASE_URL sslmode from overriding strict Pool TLS settings",()=>{const config=postgresPoolConfig({DATABASE_URL:"postgresql://user:password@db.example.test:5432/postgres?sslmode=require&application_name=pricematcher",DATABASE_SSL_CA_BASE64:Buffer.from(ca).toString("base64")});expect(config.connectionString).toBe("postgresql://user:password@db.example.test:5432/postgres?application_name=pricematcher");expect(effectivePostgresSsl({DATABASE_URL:"postgresql://user:password@db.example.test:5432/postgres?sslmode=no-verify",DATABASE_SSL_CA_BASE64:Buffer.from(ca).toString("base64")})).toEqual({rejectUnauthorized:true,ca});});
  it("supports a Supabase CA bundle while retaining default hostname verification",()=>{const ssl=effectivePostgresSsl({DATABASE_URL:"postgresql://user:password@db.example.test:5432/postgres",DATABASE_SSL_CA:ca}) as {rejectUnauthorized:boolean;ca:string;checkServerIdentity?:unknown};expect(ssl).toMatchObject({rejectUnauthorized:true,ca});expect(ssl.checkServerIdentity).toBeUndefined();});
  it("rejects malformed or conflicting CA configuration",()=>{expect(()=>postgresPoolConfig({DATABASE_URL:"postgresql://example.test/postgres",DATABASE_SSL_CA_BASE64:"not-a-certificate"})).toThrow("PEM");expect(()=>postgresPoolConfig({DATABASE_URL:"postgresql://example.test/postgres",DATABASE_SSL_CA:ca,DATABASE_SSL_CA_BASE64:Buffer.from(ca).toString("base64")})).toThrow("only one");});
  it("refuses attempts to disable certificate verification",()=>{expect(()=>postgresPoolConfig({DATABASE_URL:"postgresql://example.test/postgres",DATABASE_SSL:"disable"})).toThrow("must be require");expect(()=>postgresPoolConfig({DATABASE_URL:"postgresql://example.test/postgres",DATABASE_SSL_REJECT_UNAUTHORIZED:"false"})).toThrow("cannot be disabled");});
});
