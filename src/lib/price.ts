// ETH napi árfolyam USD-BEN ÉS HUF-BAN a CoinGecko market_chart-ból. Egy hívás
// per pénznem adja a teljes napi ársort a range-re; lokálisan a tx dátumához
// párosítjuk (nem tx-enként → a free-tier bőven elég). Napi granularitás — ez
// tárca-áttekintő, nem adó-szint.
const CG = "https://api.coingecko.com/api/v3";
const KEY = (import.meta.env.VITE_COINGECKO_KEY as string) || "";

export interface DayPrice { usd: number; huf: number; }
// "YYYY-MM-DD" -> {usd, huf}
export type PriceMap = Record<string, DayPrice>;

function dayKey(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

async function series(vs: string, days: number): Promise<Record<string, number>> {
  const q = new URLSearchParams({ vs_currency: vs, days: String(days), interval: "daily" });
  const headers: Record<string, string> = {};
  if (KEY) headers["x-cg-demo-api-key"] = KEY;
  const r = await fetch(`${CG}/coins/ethereum/market_chart?${q}`, { headers });
  if (!r.ok) throw new Error(`CoinGecko ${r.status} (${vs})`);
  const j = await r.json();
  const out: Record<string, number> = {};
  for (const [ms, price] of j.prices as [number, number][]) {
    out[new Date(ms).toISOString().slice(0, 10)] = price;
  }
  return out;
}

/** ETH USD+HUF napi ársor a legelső tx-től máig. */
export async function ethPriceMap(firstTxSec: number): Promise<PriceMap> {
  const spanDays = Math.min(
    3650,
    Math.max(2, Math.ceil((Date.now() / 1000 - firstTxSec) / 86400) + 1),
  );
  const [usd, huf] = await Promise.all([series("usd", spanDays), series("huf", spanDays)]);
  const map: PriceMap = {};
  for (const d of Object.keys(usd)) map[d] = { usd: usd[d], huf: huf[d] ?? 0 };
  // huf-only napok (ritka) feltöltése
  for (const d of Object.keys(huf)) if (!map[d]) map[d] = { usd: 0, huf: huf[d] };
  return map;
}

/** Legközelebbi ismert nap árfolyama egy tx-hez (ha a pontos nap hiányzik). */
export function priceAt(map: PriceMap, unixSec: number): DayPrice {
  const key = dayKey(unixSec);
  if (map[key]) return map[key];
  const keys = Object.keys(map).sort();
  if (!keys.length) return { usd: 0, huf: 0 };
  let best = keys[0];
  for (const k of keys) if (k <= key) best = k; else break;
  return map[best];
}

/** ETH mostani ára (USD+HUF) — a holding-értékhez. */
export async function ethSpot(): Promise<DayPrice> {
  const headers: Record<string, string> = {};
  if (KEY) headers["x-cg-demo-api-key"] = KEY;
  const r = await fetch(`${CG}/simple/price?ids=ethereum&vs_currencies=usd,huf`, { headers });
  const j = await r.json();
  return { usd: j.ethereum?.usd ?? 0, huf: j.ethereum?.huf ?? 0 };
}
