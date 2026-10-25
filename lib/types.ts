export type Currency = "USD";
export type Money = { amountMinor: number; currency: Currency };

export type Product = {
  id: string; name: string; brand: string; model: string; category: string;
  price: Money; compareAt?: Money; sku: string; gtin: string;
  variant: { color: string; size?: string; condition: "new" };
  image: string; stock: "In stock" | "Low stock"; delivery: string;
  description: string; features: string[]; priceMatchEligible: boolean;
};

export type DataProvenance = "live" | "fixture" | "cached";
export type SellerVerification = "approved" | "unverified" | "rejected";
export type MatchConfidence = "exact" | "probable" | "uncertain" | "mismatch";

export type CompetitorEvidence = {
  id: string; comparisonId: string; providerProductId: string;
  retailer: string; retailerDomain: string; sourceUrl: string;
  sourceType: DataProvenance; retrievedAt: string;
  productTitle: string; brand?: string; model?: string; gtin?: string;
  variant: { color?: string; size?: string; condition?: "new" | "used" };
  productPrice: Money; shipping: Money | null; fees: Money | null;
  deliveredCostSource: "channel3" | "retailer_api" | "fixture" | "unknown";
  deliveredCostRetrievedAt?: string;
  availability: "in_stock" | "out_of_stock" | "unknown";
  sellerVerification: SellerVerification; productMatch: MatchConfidence;
  aiAssisted: boolean; verificationReasons: string[];
};

export type PricingStrategy = { type: "match" } | { type: "better_by_fixed_amount"; amountMinor: number };
export type MerchantPolicy = {
  id: string; merchantId: string; version: number; enabled: boolean;
  eligibleProductIds: string[]; maximumDiscountBps: number;
  minimumPriceByProduct: Record<string, Money>;
  approvedCompetitorDomains: string[]; includeShipping: true;
  requireKnownShipping: boolean; currency: Currency;
  pricingStrategy: PricingStrategy; offerTtlSeconds: number; evidenceMaxAgeSeconds: number; createdAt: string;
};

export type CartItemInput = { productId: string; variantKey: string; quantity: number };
export type CartSnapshotLine = CartItemInput & { unitPrice: Money; lineTotal: Money };
export type CartSnapshot = { lines: CartSnapshotLine[]; currency: Currency; subtotal: Money; shipping: Money; tax: Money; fees: Money; total: Money };

export type ComparisonRequest = {
  id: string; merchantId: string; sessionId: string; productId: string;
  quantity: number; cartFingerprint: string; status: "requested" | "completed" | "failed";
  sourceType: DataProvenance; createdAt: string; completedAt?: string;
};

export type OfferStatus = "issued" | "accepted" | "consumed" | "expired" | "revoked";
export type AuthorizedOffer = {
  id: string; comparisonId: string; merchantId: string; sessionId: string;
  productId: string; productGtin: string; variantKey: string; quantity: number;
  cartFingerprint: string; originalUnitPrice: Money; approvedUnitPrice: Money;
  originalSubtotal: Money; approvedSubtotal: Money; tax: Money;
  shipping: Money; fees: Money; finalTotal: Money; currency: Currency;
  discountAmount: Money; policyId: string; policyVersion: number;
  evidenceId: string; evidenceSnapshot: CompetitorEvidence;
  cartSnapshot: CartSnapshot;
  createdAt: string; expiresAt: string; status: OfferStatus;
  acceptedAt?: string; consumedAt?: string;
  lineAdjustments?: AuthorizedLineAdjustment[];
  authorizationKind?: "matched" | "original";
};

export type ComparisonStatus = "VERIFIED_MATCH" | "POSSIBLE_MATCH" | "NO_VERIFIED_MATCH" | "INSUFFICIENT_DATA" | "SOURCE_UNAVAILABLE";
export type PolicyOutcome = "BETTER_OFFER" | "PRICE_MATCH" | "KEEP_ORIGINAL" | "UNVERIFIED";
export type AuthorizedLineAdjustment = {
  productId: string; productName: string; variantKey: string; quantity: number;
  originalUnitPrice: Money; authorizedUnitPrice: Money; originalLineTotal: Money;
  finalLineTotal: Money; savings: Money; comparisonStatus: ComparisonStatus;
  policyOutcome: PolicyOutcome; explanation: string; evidence?: CompetitorEvidence;
};
export type CartComparisonResult = {
  lines: AuthorizedLineAdjustment[]; offer?: AuthorizedOffer;
  sourceType: DataProvenance; checkedAt: string;
};

export type OfferAcceptance = { id: string; offerId: string; merchantId: string; sessionId: string; acceptedAt: string; cartFingerprint: string };
export type PricingDecision = {
  eligible: boolean; reasonCode: "eligible" | "already_competitive" | "no_eligible_offer";
  reason: string; originalUnitPrice: Money; competitorDeliveredTotal?: Money;
  approvedUnitPrice: Money; discountAmount: Money; evidenceId?: string;
};
export type ComparisonResult = { comparison: ComparisonRequest; decision: PricingDecision; evidence: CompetitorEvidence[]; offer?: AuthorizedOffer };

export type CheckoutAttemptStatus = "prepared" | "order_pending" | "order_created" | "buyer_approved" | "capture_pending" | "captured" | "failed" | "reconciliation_required" | "reconciled";
export type CheckoutAttempt = {
  id: string; offerId: string; merchantId: string; sessionId: string;
  provider: "paypal_sandbox"; idempotencyKey: string; expectedAmount: Money;
  status: CheckoutAttemptStatus; providerOrderId?: string; providerTransactionId?: string;
  buyerApprovedAt?: string; capturedAt?: string; failureCode?: string;
  reconciliationStatus: "not_required" | "pending" | "matched" | "mismatch";
  createdAt: string; updatedAt: string;
};
export type PaymentInstruction = {
  checkoutAttemptId: string; offerId: string; merchantId: string;
  provider: "paypal_sandbox"; intent: "CAPTURE"; amount: Money;
  idempotencyKey: string; description: string;
};
export type TransactionAuditEvent = { id: string; checkoutAttemptId?: string; offerId: string; eventType: string; payload: Record<string, unknown>; createdAt: string };
