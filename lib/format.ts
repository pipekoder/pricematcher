import type { Money } from "./types";

export const formatMoney = (money: Money) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: money.currency }).format(money.amountMinor / 100);
export const formatUsd = (amountMinor: number) => formatMoney({ amountMinor, currency: "USD" });
export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(value));
