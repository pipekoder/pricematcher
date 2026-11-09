import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatUsd } from "@/lib/format";

const decisions = [
  ["PM-1048", "Nord Sound 2", "$149", "$139", "Accepted", "Demo fixture"],
  ["PM-1047", "Tempo Watch", "$229", "—", "Already competitive", "Demo fixture"],
  ["PM-1046", "Arc Table Lamp", "$89", "—", "Already competitive", "Demo fixture"],
  ["PM-1045", "Still Kettle 1.2L", "$109", "—", "Seller unverified", "Demo fixture"],
];

export default function MerchantPage() {
  return <div className="page-shell"><div className="dashboard-head"><div><p className="eyebrow">SOLE · Merchant demo</p><h1 className="page-title">Price intelligence</h1><p className="subhead">A fixture-based preview of how independently configured offers can help retain customers.</p></div><Link className="button" href="/merchant/policies">Pricing policies <ArrowUpRight size={16} /></Link></div><div className="demo-label" style={{ marginTop: 30, display: "inline-block" }}>All metrics below are simulated estimates</div><section className="stat-grid"><div className="stat-card"><strong>128</strong><span>Eligible comparisons</span></div><div className="stat-card"><strong>46</strong><span>Offers generated</span></div><div className="stat-card"><strong>31</strong><span>Offers accepted</span></div><div className="stat-card"><strong>{formatUsd(324000)}</strong><span>Approved discount value</span></div></section><section><div className="section-heading"><div><p className="eyebrow">Decision audit</p><h2 style={{ fontSize: 36 }}>Recent comparisons</h2></div><p>Estimated retained sales: 22 · Completed transactions: 18. These values are illustrative until persistence and PayPal are connected.</p></div><table className="data-table"><thead><tr><th>Decision</th><th>Product</th><th>Original</th><th>Offer</th><th>Outcome</th><th>Source</th></tr></thead><tbody>{decisions.map((row) => <tr key={row[0]}>{row.map((cell, i) => <td key={cell}>{i === 4 ? <span className="status-pill">{cell}</span> : cell}</td>)}</tr>)}</tbody></table></section></div>;
}
