import type { Currency, Money } from "./types";

export function money(amountMinor: number, currency: Currency = "USD"): Money {
  if (!Number.isSafeInteger(amountMinor)) throw new Error("Money must use safe integer minor units.");
  return { amountMinor, currency };
}
export function addMoney(...values: Money[]): Money {
  const currency = values[0]?.currency ?? "USD";
  if (values.some((value) => value.currency !== currency)) throw new Error("Currency mismatch.");
  return money(values.reduce((total, value) => total + value.amountMinor, 0), currency);
}
export function multiplyMoney(value: Money, quantity: number): Money {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Quantity must be a positive integer.");
  return money(value.amountMinor * quantity, value.currency);
}
export function subtractMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency) throw new Error("Currency mismatch.");
  return money(left.amountMinor - right.amountMinor, left.currency);
}
