"use client";

import { useState } from "react";
import { BadgeCheck, X } from "lucide-react";

export function PriceMatcherBadge({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <span className="badge-wrap"><button className={`pm-badge ${compact ? "compact" : ""}`} onClick={() => setOpen(true)}><BadgeCheck size={15} />PriceMatcher Enabled</button>{open && <span className="badge-popover" role="dialog" aria-label="About PriceMatcher"><button aria-label="Close" onClick={() => setOpen(false)}><X size={16} /></button><strong>A fairer price, when it counts.</strong><small>We compare exact products, verify sellers and include delivery costs. Any offer stays within this retailer&apos;s independent pricing policy.</small><LinkLike /></span>}</span>;
}

function LinkLike() { return <a href="/about">How matching works →</a>; }
