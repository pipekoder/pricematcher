"use client";

import { useState } from "react";
import { BadgeCheck, X } from "lucide-react";

export function PriceMatcherBadge({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <span className="badge-wrap"><button type="button" className={`pm-badge ${compact ? "compact" : ""}`} onClick={() => setOpen(true)}><BadgeCheck size={15} />Deal Engine available</button>{open && <span className="badge-popover" role="dialog" aria-label="About Deal Engine"><button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={16} /></button><strong>AI-powered deal-making at checkout.</strong><small>Channel3 market observations inform AI recommendations. Merchant policy independently authorizes any Sandbox offer; unknown shipping and fees remain unknown.</small><LinkLike /></span>}</span>;
}

function LinkLike() { return <a href="/about">How Deal Engine works →</a>; }
