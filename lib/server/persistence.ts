import { join } from "node:path";
import { Pool, type PoolConfig } from "pg";
import { FilePriceIntelligenceRepository } from "../persistence/file-repository";
import { PostgresPriceIntelligenceRepository } from "../persistence/postgres-repository";
import { MemoryTransactionRepository } from "../payments/memory-transaction-repository";
import { PostgresTransactionRepository } from "../payments/postgres-transaction-repository";
import { classifyDatabaseError } from "./database-health";

type Persistence = { offers: FilePriceIntelligenceRepository|PostgresPriceIntelligenceRepository; transactions: MemoryTransactionRepository|PostgresTransactionRepository; backend: "local"|"postgres"; check:()=>Promise<void> };
const state=globalThis as typeof globalThis&{priceMatcherPersistence?:Persistence};
export function resolvePersistenceBackend(env:Record<string,string|undefined>){const shared=env.APP_ENV==="production";const backend=env.PERSISTENCE_BACKEND??(shared?"postgres":"local");if(backend!=="local"&&backend!=="postgres")throw new Error("PERSISTENCE_BACKEND must be local or postgres");if(shared&&backend!=="postgres")throw new Error("Shared deployments require PERSISTENCE_BACKEND=postgres");if(backend==="postgres"&&!env.DATABASE_URL)throw new Error("DATABASE_URL is required for PostgreSQL persistence");return backend;}
function positiveInteger(value:string|undefined,fallback:number){const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:fallback;}
export function postgresPoolConfig(env:Record<string,string|undefined>):PoolConfig{const connectionString=env.DATABASE_URL;if(!connectionString)throw new Error("DATABASE_URL is required for PostgreSQL persistence");return{connectionString,max:positiveInteger(env.DATABASE_POOL_MAX,3),connectionTimeoutMillis:positiveInteger(env.DATABASE_CONNECT_TIMEOUT_MS,4_500),query_timeout:positiveInteger(env.DATABASE_QUERY_TIMEOUT_MS,4_000),statement_timeout:positiveInteger(env.DATABASE_STATEMENT_TIMEOUT_MS,4_000),idleTimeoutMillis:positiveInteger(env.DATABASE_IDLE_TIMEOUT_MS,30_000),allowExitOnIdle:true,keepAlive:true,keepAliveInitialDelayMillis:10_000,ssl:env.DATABASE_SSL==="disable"?false:{rejectUnauthorized:env.DATABASE_SSL_REJECT_UNAUTHORIZED!=="false"}};}
export function getPersistence():Persistence{
  if(state.priceMatcherPersistence)return state.priceMatcherPersistence;
  const backend=resolvePersistenceBackend(process.env);
  if(backend==="postgres"){
    const pool=new Pool(postgresPoolConfig(process.env));
    pool.on("error",(error)=>console.error(JSON.stringify({event:"postgres_pool_error",category:classifyDatabaseError(error),backend:"postgres"})));
    const offers=new PostgresPriceIntelligenceRepository(pool);return state.priceMatcherPersistence={offers,transactions:new PostgresTransactionRepository(pool),backend,check:async()=>{await pool.query("select 1");}};
  }
  const offers=new FilePriceIntelligenceRepository(process.env.PRICE_MATCHER_DATA_FILE??join(process.cwd(),".data","price-intelligence.json"));return state.priceMatcherPersistence={offers,transactions:new MemoryTransactionRepository(offers),backend:"local",check:async()=>{}};
}
