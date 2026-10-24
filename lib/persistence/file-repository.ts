import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuthorizedOffer, ComparisonRequest, CompetitorEvidence, MerchantPolicy, OfferAcceptance } from "../types";
import { MemoryPriceIntelligenceRepository } from "./memory-repository";
import type { AcceptInput } from "./repository";

type State = { policies: MerchantPolicy[]; comparisons: ComparisonRequest[]; evidence: CompetitorEvidence[]; offers: AuthorizedOffer[]; acceptances: OfferAcceptance[] };
type Envelope = { version: 1; checksum: string; data: State };
const emptyState = (): State => ({ policies: [], comparisons: [], evidence: [], offers: [], acceptances: [] });
const checksum = (state: State) => createHash("sha256").update(JSON.stringify(state)).digest("hex");
function validate(value: unknown): State {
  if (!value || typeof value !== "object") throw new Error("PriceMatcher storage is corrupt");
  const envelope = value as Partial<Envelope>; const data = envelope.data;
  if (envelope.version !== 1 || !data || !Array.isArray(data.policies) || !Array.isArray(data.comparisons) || !Array.isArray(data.evidence) || !Array.isArray(data.offers) || !Array.isArray(data.acceptances) || envelope.checksum !== checksum(data)) throw new Error("PriceMatcher storage integrity check failed");
  return data;
}

export class FilePriceIntelligenceRepository extends MemoryPriceIntelligenceRepository {
  private loaded = false; private fileQueue = Promise.resolve();
  constructor(private readonly path: string) { super(); }
  private hydrate(state: State) { this.policies.clear(); this.comparisons.clear(); this.evidence.clear(); this.offers.clear(); state.policies.forEach((x) => this.policies.set(x.merchantId, x)); state.comparisons.forEach((x) => this.comparisons.set(x.id, x)); state.evidence.forEach((x) => this.evidence.set(x.id, x)); state.offers.forEach((x) => this.offers.set(x.id, x)); this.acceptances = state.acceptances; }
  private async load() {
    if (this.loaded) return;
    try { this.hydrate(validate(JSON.parse(await readFile(this.path, "utf8")))); this.loaded = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") { this.hydrate(emptyState()); this.loaded = true; return; } throw error; }
  }
  private state(): State { return { policies: [...this.policies.values()], comparisons: [...this.comparisons.values()], evidence: [...this.evidence.values()], offers: [...this.offers.values()], acceptances: this.acceptances }; }
  private async persist() { const state = this.state(); await mkdir(dirname(this.path), { recursive: true }); const temp = `${this.path}.${process.pid}.${randomUUID()}.tmp`; const envelope: Envelope = { version: 1, checksum: checksum(state), data: state }; await writeFile(temp, JSON.stringify(envelope, null, 2), { mode: 0o600 }); await rename(temp, this.path); }
  private async disk<T>(fn: () => Promise<T>) {
    const result = this.fileQueue.then(async () => {
      await mkdir(dirname(this.path), { recursive: true }); const lockPath = `${this.path}.lock`; let lock;
      try { lock = await open(lockPath, "wx", 0o600); await this.load(); const before = structuredClone(this.state()); try { const value = await fn(); await this.persist(); return value; } catch (error) { this.hydrate(before); throw error; } }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("PriceMatcher storage is busy; request was not processed"); throw error; }
      finally { if (lock) { await lock.close(); await unlink(lockPath).catch(() => undefined); } }
    });
    this.fileQueue = result.then(() => undefined, () => undefined); return result;
  }
  override async getPolicy(id: string) { await this.fileQueue; await this.load(); return super.getPolicy(id); }
  override async getOffer(id: string) { await this.fileQueue; await this.load(); return super.getOffer(id); }
  override savePolicy(value: MerchantPolicy) { return this.disk(() => super.savePolicy(value)); }
  override saveComparison(value: ComparisonRequest) { return this.disk(() => super.saveComparison(value)); }
  override saveEvidence(value: CompetitorEvidence[]) { return this.disk(() => super.saveEvidence(value)); }
  override saveOffer(value: AuthorizedOffer) { return this.disk(() => super.saveOffer(value)); }
  override acceptOffer(value: AcceptInput) { return this.disk(() => super.acceptOffer(value)); }
  override consumeOffer(id: string, now: Date) { return this.disk(() => super.consumeOffer(id, now)); }
}
