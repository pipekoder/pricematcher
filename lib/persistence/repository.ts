import type { AuthorizedOffer, ComparisonRequest, CompetitorEvidence, MerchantPolicy, OfferAcceptance } from "../types";

export type AcceptInput = { offerId: string; sessionId: string; cartFingerprint: string; expectedPolicyId: string; expectedPolicyVersion: number; now: Date };
export interface PriceIntelligenceRepository {
  getPolicy(merchantId: string): Promise<MerchantPolicy | undefined>;
  savePolicy(policy: MerchantPolicy): Promise<void>;
  saveComparison(comparison: ComparisonRequest): Promise<void>;
  saveEvidence(evidence: CompetitorEvidence[]): Promise<void>;
  saveOffer(offer: AuthorizedOffer): Promise<void>;
  getOffer(id: string): Promise<AuthorizedOffer | undefined>;
  acceptOffer(input: AcceptInput): Promise<{ offer: AuthorizedOffer; acceptance: OfferAcceptance }>;
  revokeOffer(id: string, now: Date, reason: string): Promise<AuthorizedOffer>;
  expireOffers(now: Date): Promise<number>;
  consumeOffer(id: string, now: Date): Promise<AuthorizedOffer>;
}

export class OfferValidationError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
