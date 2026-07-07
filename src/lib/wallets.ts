// Multi-wallet watchlist — WATCH-ONLY (csak cím, SOHA privkulcs/aláírás).
// localStorage-ba perzisztálva; add/rename/remove; típus auto-detektálás.

export type WalletType = "evm" | "sol" | "btc";
export interface Wallet { id: string; address: string; label: string; type: WalletType; }

const KEY = "wallet-overview-watchlist-v1";

export function detectType(addr: string): WalletType | null {
  const s = addr.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(s)) return "evm";
  // BTC: bech32 (bc1…) vagy legacy/p2sh (1… / 3…)
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(s)) return "btc";
  // Solana base58 pubkey (32-44 char, base58 alphabet, nincs 0/O/I/l)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return "sol";
  return null;
}

export function loadWallets(): Wallet[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((w) => w && w.address && w.type) : [];
  } catch { return []; }
}

export function saveWallets(list: Wallet[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* privát mód / kvóta */ }
}

let seq = 0;
export function addWallet(list: Wallet[], address: string, label: string): { list: Wallet[]; error?: string } {
  const s = address.trim();
  const type = detectType(s);
  if (!type) return { list, error: "Ismeretlen cím-formátum (ETH 0x… / SOL base58 / BTC bc1…/1…/3…)." };
  const norm = type === "evm" ? s.toLowerCase() : s;
  if (list.some((w) => w.address === norm)) return { list, error: "Ez a cím már a listán van." };
  const id = `${Date.now().toString(36)}-${(seq++).toString(36)}`;
  const next = [...list, { id, address: norm, label: label.trim() || defaultLabel(type, list), type }];
  saveWallets(next);
  return { list: next };
}

function defaultLabel(type: WalletType, list: Wallet[]): string {
  const n = list.filter((w) => w.type === type).length + 1;
  const base = type === "evm" ? "EVM tárca" : type === "sol" ? "Solana tárca" : "Bitcoin tárca";
  return `${base} ${n}`;
}

export function removeWallet(list: Wallet[], id: string): Wallet[] {
  const next = list.filter((w) => w.id !== id);
  saveWallets(next);
  return next;
}

export function renameWallet(list: Wallet[], id: string, label: string): Wallet[] {
  const next = list.map((w) => (w.id === id ? { ...w, label: label.trim() || w.label } : w));
  saveWallets(next);
  return next;
}
