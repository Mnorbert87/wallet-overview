// Multi-wallet watchlist — WATCH-ONLY (csak cím, SOHA privkulcs/aláírás).
// localStorage-ba perzisztálva; add/rename/remove; típus auto-detektálás.
import { t } from "./i18n";

export type WalletType = "evm" | "sol" | "btc";
// A2: az `ens` a REVERSE-RESOLVED név (resolveInput-ból), KÜLÖN a labeltől — a nyers
// hex címek generikus labelt kapnak, azt TILOS ENS-ként mutatni. ensAvatar: ENS avatar URL.
export interface Wallet { id: string; address: string; label: string; type: WalletType; ens?: string; ensAvatar?: string; }

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
    // #WO-3: a `type`-ot WHITELIST-elni kell (evm|sol|btc). Egy korrupt/legacy/kézzel
    // szerkesztett localStorage-bejegyzés (pl. type:"eth") különben átcsúszik és a
    // Watchlist TYPE_META[type]=undefined dereference-en az EGÉSZ appot ledobja (nincs
    // error boundary). A whitelist önmagában megszünteti a crash-on-load-ot.
    return Array.isArray(arr)
      ? arr.filter((w) => w && w.address && (w.type === "evm" || w.type === "sol" || w.type === "btc"))
      : [];
  } catch { return []; }
}

export function saveWallets(list: Wallet[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* privát mód / kvóta */ }
}

let seq = 0;
export function addWallet(list: Wallet[], address: string, label: string, ens?: string, ensAvatar?: string): { list: Wallet[]; error?: string } {
  const s = address.trim();
  const type = detectType(s);
  // #WO-3: i18n KULCS-ot adunk vissza (nem nyers HU szöveg) — a hívó t()-vel oldja fel.
  if (!type) return { list, error: "err.unknownFormat" };
  const norm = type === "evm" ? s.toLowerCase() : s;
  if (list.some((w) => w.address === norm)) return { list, error: "err.duplicate" };
  const id = `${Date.now().toString(36)}-${(seq++).toString(36)}`;
  // A2: az ens a resolveInput reverse-resolved neve — külön mező, sosem a label.
  const next = [...list, {
    id, address: norm, label: label.trim() || defaultLabel(type, list), type,
    ...(ens ? { ens } : {}), ...(ensAvatar ? { ensAvatar } : {}),
  }];
  saveWallets(next);
  return { list: next };
}

function defaultLabel(type: WalletType, list: Wallet[]): string {
  const n = list.filter((w) => w.type === type).length + 1;
  // #WO-4: az alap-címke i18n-en át (a persisted szöveg az aktuális nyelven készül,
  // az EN-only publikus buildben így nem HU "EVM tárca" jelenik meg).
  return t(`wl.defaultLabel.${type}`, { n });
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
