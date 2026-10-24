import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuthorizedOffer, ComparisonRequest, CompetitorEvidence, MerchantPolicy, OfferAcceptance } from "../types";
import { MemoryPriceIntelligenceRepository } from "./memory-repository";
import type { AcceptInput } from "./repository";

type State = { policies: MerchantPolicy[]; comparisons: ComparisonRequest[]; evidence: CompetitorEvidence[]; offers: AuthorizedOffer[]; acceptances: OfferAcceptance[] };
export class FilePriceIntelligenceRepository extends MemoryPriceIntelligenceRepository {
  private loaded = false; private fileQueue = Promise.resolve();
  constructor(private readonly path: string) { super(); }
  private async load() { if (this.loaded) return; this.loaded = true; try { const s = JSON.parse(await readFile(this.path, "utf8")) as State; s.policies.forEach((x) => this.policies.set(x.merchantId, x)); s.comparisons.forEach((x) => this.comparisons.set(x.id, x)); s.evidence.forEach((x) => this.evidence.set(x.id, x)); s.offers.forEach((x) => this.offers.set(x.id, x)); this.acceptances = s.acceptances; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; } }
  private async persist() { await mkdir(dirname(this.path), { recursive: true }); const tmp = `${this.path}.${process.pid}.tmp`; const state: State = { policies: [...this.policies.values()], comparisons: [...this.comparisons.values()], evidence: [...this.evidence.values()], offers: [...this.offers.values()], acceptances: this.acceptances }; await writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 }); await rename(tmp, this.path); }
  private async disk<T>(fn: () => Promise<T>) { const result = this.fileQueue.then(async () => { await this.load(); const value = await fn(); await this.persist(); return value; }); this.fileQueue = result.then(() => undefined, () => undefined); return result; }
  override async getPolicy(id: string) { await this.load(); return super.getPolicy(id); }
  override async getOffer(id: string) { await this.load(); return super.getOffer(id); }
  override savePolicy(v: MerchantPolicy) { return this.disk(() => super.savePolicy(v)); }
  override saveComparison(v: ComparisonRequest) { return this.disk(() => super.saveComparison(v)); }
  override saveEvidence(v: CompetitorEvidence[]) { return this.disk(() => super.saveEvidence(v)); }
  override saveOffer(v: AuthorizedOffer) { return this.disk(() => super.saveOffer(v)); }
  override acceptOffer(v: AcceptInput) { return this.disk(() => super.acceptOffer(v)); }
  override consumeOffer(id: string, now: Date) { return this.disk(() => super.consumeOffer(id, now)); }
}
