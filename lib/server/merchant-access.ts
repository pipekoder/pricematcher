import { timingSafeEqual } from "node:crypto";

export function merchantAccessGranted(header: string | null) {
  const configured = process.env.MERCHANT_DEMO_ACCESS_TOKEN;
  if (!configured || configured.length < 24 || !header?.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const supplied = decoded.startsWith("merchant:") ? decoded.slice(9) : "";
    const left = Buffer.from(supplied), right = Buffer.from(configured);
    return left.length === right.length && timingSafeEqual(left,right);
  } catch { return false; }
}
