import { channel3DemoInvestigation, channel3DemoProducts, channel3DemoScenarios } from "@/lib/price-intelligence/channel3-demo-catalog";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function Channel3DemoPage() {
  const multiMerchantProducts = channel3DemoProducts.filter((product) => product.offers.length > 1).length;

  return <div className="page-shell">
    <p className="eyebrow">Channel3 / real product demo</p>
    <h1 className="page-title">Live evidence, conservative decisions.</h1>
    <p className="subhead">This catalog is separate from the fictional store catalog. Every product and offer below was returned by one authenticated Channel3 search.</p>
    <div className="stat-grid">
      <div className="stat-card"><strong>{channel3DemoProducts.length}</strong><span>verified real products</span></div>
      <div className="stat-card"><strong>{channel3DemoInvestigation.requestCount}/{channel3DemoInvestigation.requestBudget}</strong><span>API request budget used</span></div>
      <div className="stat-card"><strong>{multiMerchantProducts}</strong><span>multi-merchant products</span></div>
      <div className="stat-card"><strong>{channel3DemoInvestigation.status}</strong><span>integration status</span></div>
    </div>
    <section className="compare-panel">
      <span className="demo-label">Authenticated live result</span>
      <h2>Verification result</h2>
      <p>{channel3DemoInvestigation.summary}</p>
      <p>Window: <time dateTime={channel3DemoInvestigation.requestedAt}>{channel3DemoInvestigation.requestedAt}</time> — <time dateTime={channel3DemoInvestigation.completedAt}>{channel3DemoInvestigation.completedAt}</time></p>
      <div className="evidence">{channel3DemoInvestigation.queries.map((query) => <div className="evidence-row" key={query}><span>{query}</span><strong>Success</strong></div>)}</div>
    </section>
    <section className="collection" style={{ paddingLeft: 0, paddingRight: 0 }}>
      <div className="section-heading"><div><p className="eyebrow">Verified catalog</p><h2>Real Channel3 results</h2></div><p>Prices are product prices only. Unknown shipping and fees make every offer non-actionable.</p></div>
      <div className="product-grid">{channel3DemoProducts.map((product) => <article className="stat-card" key={product.channel3ProductId}>
        <span className="demo-label">Channel3 ID {product.channel3ProductId}</span>
        <h3>{product.name}</h3>
        <p>{Object.entries(product.variant).map(([key, value]) => `${key}: ${value}`).join(" · ")}</p>
        <small>Retrieved <time dateTime={product.retrievedAt}>{product.retrievedAt}</time></small>
        <div className="evidence">{product.offers.map((offer) => <div className="evidence-row" key={offer.url}>
          <span><a href={offer.url} target="_blank" rel="noreferrer">{offer.merchant}</a><br /><small>Shipping + fees unknown</small></span>
          <strong>{money.format(offer.price.amountMinor / 100)}<br /><small>Not actionable</small></strong>
        </div>)}</div>
      </article>)}</div>
    </section>
    <section className="collection" style={{ paddingLeft: 0, paddingRight: 0 }}><div className="section-heading"><div><p className="eyebrow">Authorization controls</p><h2>Three demo outcomes</h2></div><p>Merchant prices are configured demo prices. Competitor fixtures are never presented as live merchant prices.</p></div><div className="product-grid">{channel3DemoScenarios.map((scenario) => <article className="stat-card" key={scenario.id}><span className="demo-label">{scenario.evidence}</span><h3>{scenario.title}</h3><p className="subhead">{scenario.explanation}</p><strong style={{ fontSize: 18 }}>{scenario.actionable ? "Fixture-authorized" : "Not actionable"}</strong></article>)}</div></section>
    <section className="trust-note"><strong>Delivered-cost limitation</strong><br />A live Channel3 product price is not an executable match when shipping or mandatory fees are unknown. Unknown values remain unknown—never zero—and no live discount is generated.</section>
  </div>;
}
