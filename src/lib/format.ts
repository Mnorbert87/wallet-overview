export function fmtUsd(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
}
export function fmtHuf(n: number): string {
  return Math.round(n).toLocaleString("hu-HU") + " Ft";
}
export function fmtEth(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 }) + " ETH";
}
export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
import { getLang } from "./i18n";

export function fmtDate(unixSec: number): string {
  // #WO-i18n: EN módban NE magyar dátumformátum ('2026. júl. 10.') — kövessük a UI-nyelvet.
  const locale = getLang() === "en" ? "en-US" : "hu-HU";
  return new Date(unixSec * 1000).toLocaleDateString(locale, {
    year: "numeric", month: "short", day: "numeric",
  });
}
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}.${m}`;
}
export function isEthAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}
