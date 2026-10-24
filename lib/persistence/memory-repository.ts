import { randomUUID } from "node:crypto";
import type { AuthorizedOffer, ComparisonRequest, CompetitorEvidence, MerchantPolicy, OfferAcceptance } from "../types";
import { OfferValidationError, type AcceptInput, type PriceIntelligenceRepository } from "./repository";

export class MemoryPriceIntelligenceRepository implements PriceIntelligenceRepository {
  policies = new Map<string, MerchantPolicy>(); comparisons = new Map<string, ComparisonRequest>();
  evidence = new Map<string, CompetitorEvidence>(); offers = new Map<string, AuthorizedOffer>(); acceptances: OfferAcceptance[] = [];
  private queue = Promise.resolve();
  async savePolicy(p: MerchantPolicy) { this.policies.set(p.merchantId, structuredClone(p)); }
  async getPolicy(id: string) { const p = this.policies.get(id); return p && structuredClone(p); }
  async saveComparison(c: ComparisonRequest) { this.comparisons.set(c.id, structuredClone(c)); }
  async saveEvidence(items: CompetitorEvidence[]) { items.forEach((e) => this.evidence.set(e.id, structuredClone(e))); }
  async saveOffer(o: AuthorizedOffer) { this.offers.set(o.id, structuredClone(o)); }
  async getOffer(id: string) { const o = this.offers.get(id); return o && structuredClone(o); }
  async acceptOffer(input: AcceptInput) { return this.lock(async () => {
    const offer = this.offers.get(input.offerId);
    if (!offer) throw new OfferValidationError("not_found", "Offer not found");
    if (offer.sessionId !== input.sessionId) throw new OfferValidationError("unauthorized", "Offer belongs to another session");
    if (offer.cartFingerprint !== input.cartFingerprint) throw new OfferValidationError("cart_changed", "Cart no longer matches the offer");
    if (new Date(offer.expiresAt) <= input.now) { offer.status = "expired"; throw new OfferValidationError("expired", "Offer has expired"); }
    if (offer.status !== "issued") throw new OfferValidationError("replay", "Offer has already been accepted or consumed");
    offer.status = "accepted"; offer.acceptedAt = input.now.toISOString();
    const acceptance = { id: randomUUID(), offerId: offer.id, merchantId: offer.merchantId, sessionId: offer.sessionId, acceptedAt: offer.acceptedAt, cartFingerprint: offer.cartFingerprint };
    this.acceptances.push(acceptance); return { offer: structuredClone(offer), acceptance: structuredClone(acceptance) };
  }); }
  async consumeOffer(id: string, now: Date) { return this.lock(async () => { const o = this.offers.get(id); if (!o || o.status !== "accepted") throw new OfferValidationError("invalid_status", "Accepted offer required"); o.status = "consumed"; o.consumedAt = now.toISOString(); return structuredClone(o); }); }
  private lock<T>(fn: () => Promise<T>): Promise<T> { const result = this.queue.then(fn, fn); this.queue = result.then(() => undefined, () => undefined); return result; }
}
