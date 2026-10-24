import { join } from "node:path";
import { Pool } from "pg";
import { FilePriceIntelligenceRepository } from "../persistence/file-repository";
import { PostgresPriceIntelligenceRepository } from "../persistence/postgres-repository";
import { MemoryTransactionRepository } from "../payments/memory-transaction-repository";
import { PostgresTransactionRepository } from "../payments/postgres-transaction-repository";

type Persistence = { offers: FilePriceIntelligenceRepository|PostgresPriceIntelligenceRepository; transactions: MemoryTransactionRepository|PostgresTransactionRepository; backend: "local"|"postgres"; check:()=>Promise<void> };
const state=globalThis as typeof globalThis&{priceMatcherPersistence?:Persistence};
export function resolvePersistenceBackend(env:Record<string,string|undefined>){const shared=env.APP_ENV==="production";const backend=env.PERSISTENCE_BACKEND??(shared?"postgres":"local");if(backend!=="local"&&backend!=="postgres")throw new Error("PERSISTENCE_BACKEND must be local or postgres");if(shared&&backend!=="postgres")throw new Error("Shared deployments require PERSISTENCE_BACKEND=postgres");if(backend==="postgres"&&!env.DATABASE_URL)throw new Error("DATABASE_URL is required for PostgreSQL persistence");return backend;}
export function getPersistence():Persistence{
  if(state.priceMatcherPersistence)return state.priceMatcherPersistence;
  const backend=resolvePersistenceBackend(process.env);
  if(backend==="postgres"){
    const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error("DATABASE_URL is required for PostgreSQL persistence");
    const pool=new Pool({connectionString,max:Number(process.env.DATABASE_POOL_MAX??"10"),ssl:process.env.DATABASE_SSL==="disable"?false:{rejectUnauthorized:process.env.DATABASE_SSL_REJECT_UNAUTHORIZED!=="false"}});
    const offers=new PostgresPriceIntelligenceRepository(pool);return state.priceMatcherPersistence={offers,transactions:new PostgresTransactionRepository(pool),backend,check:async()=>{await pool.query("select 1");}};
  }
  const offers=new FilePriceIntelligenceRepository(process.env.PRICE_MATCHER_DATA_FILE??join(process.cwd(),".data","price-intelligence.json"));return state.priceMatcherPersistence={offers,transactions:new MemoryTransactionRepository(offers),backend:"local",check:async()=>{}};
}
