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

// Free-tier (kulcs nélküli) market_chart max ~365 nap; efölött 4xx. Kulccsal tágabb.
// Az `interval` paramétert szándékosan NEM küldjük — a CG auto-granularitása 90+ napra
// úgyis napi bontást ad, viszont kulcs nélkül a `interval=daily` 4xx-et dob.
const KEYLESS_MAX_DAYS = 365;

// Degradáció-jelző: ha az ársor-lekérés (részben) elbukott, a hívó ebből tudja,
// hogy az árak hiányosak lehetnek — DE a valós on-chain adat így is renderelhető
// (nincs néma mock-fallback).
let _lastDegraded = false;

/** true, ha a legutóbbi ethPriceMap()-hívás nem tudta a teljes ársort lekérni. */
export function priceDataDegraded(): boolean {
  return _lastDegraded;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// #WO price-retry: minden CG-hívás retry-el 429/5xx-re (mint bitcoin.ts/solana.ts/
// multichain.ts). null visszatérés = végleges bukás (a hívó dönt: degradált/0).
async function cgGet(path: string): Promise<any | null> {
  const headers: Record<string, string> = {};
  if (KEY) headers["x-cg-demo-api-key"] = KEY;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${CG}/${path}`, { headers, referrerPolicy: "no-referrer" });
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) return null; // nem-retriable
    } catch { /* hálózati hiba → retry */ }
    if (i < 2) await sleep(500 * (i + 1));
  }
  return null;
}

// Egy pénznem napi ársora. Hiba esetén NEM dob — üres sort ad vissza és jelzi a bukást.
async function series(vs: string, days: number): Promise<Record<string, number>> {
  const q = new URLSearchParams({ vs_currency: vs, days: String(days) });
  const out: Record<string, number> = {};
  const j = await cgGet(`coins/ethereum/market_chart?${q}`);
  if (!j || !Array.isArray(j.prices)) {
    _lastDegraded = true;
    return out;
  }
  for (const [ms, price] of j.prices as [number, number][]) {
    out[new Date(ms).toISOString().slice(0, 10)] = price;
  }
  return out;
}

/** ETH USD+HUF napi ársor a legelső tx-től máig. Hiba esetén részleges/üres map
 *  (priceDataDegraded()===true), nem dob — így a hívó a valós lánc-adatot renderelheti. */
export async function ethPriceMap(firstTxSec: number): Promise<PriceMap> {
  _lastDegraded = false;
  const maxDays = KEY ? 3650 : KEYLESS_MAX_DAYS;
  const wantDays = Math.max(2, Math.ceil((Date.now() / 1000 - firstTxSec) / 86400) + 1);
  const spanDays = Math.min(maxDays, wantDays);
  // #5: ha a tárca-history hosszabb mint amennyi ársort le tudunk kérni (keyless
  // 365 nap), a 365 napnál régebbi tx-ek az ~1 éve árán értékelődnek → degradált.
  if (wantDays > maxDays) _lastDegraded = true;

  // QUICK-WIN #6: localStorage ár-cache. A múltbeli napi árak VÁLTOZHATATLANOK, a
  // mai árra rövid TTL. Friss (<15 perc) és a kért range-t lefedő cache → nincs újabb
  // CG-hívás (free-tier kímélés reload-onként). Egyébként fetch + MERGE a cache-be (a
  // régi napok megmaradnak), és a szériahiba (429) esetén a cache-fallback jobb mint üres.
  const cached = loadPxCache();
  const nowMs = Date.now();
  if (cached && cached.spanDays >= spanDays && (nowMs - cached.ts) < TODAY_TTL_MS) {
    return cached.map;
  }

  // #WO price-retry: a két szériát SZÉRIÁLISAN kérjük (nem Promise.all) — felezi a
  // pillanatnyi CG-request-burst-öt, kevesebb 429 a keyless free-tieren.
  const usd = await series("usd", spanDays);
  const huf = await series("huf", spanDays);
  // A cache-elt (immutable) napokból indulunk, hogy egy részleges/hibás fetch se dobja el őket.
  const map: PriceMap = cached ? { ...cached.map } : {};
  for (const d of Object.keys(usd)) map[d] = { usd: usd[d], huf: huf[d] ?? 0 };
  for (const d of Object.keys(huf)) if (!map[d]) map[d] = { usd: 0, huf: huf[d] };

  if (Object.keys(usd).length === 0 && cached) {
    // teljes fetch-bukás → a cache (immutable múlt) jobb mint üres; NE frissítsük felül
    return cached.map;
  }
  savePxCache(map, nowMs, Math.max(spanDays, cached?.spanDays ?? 0));
  return map;
}

// ── QUICK-WIN #6: ár-cache localStorage (wo-pxcache) ──────────────────────────
const PXCACHE_KEY = "wo-pxcache";
const TODAY_TTL_MS = 15 * 60 * 1000; // a mai árra rövid TTL; a múlt így is immutable a merge miatt
function loadPxCache(): { map: PriceMap; ts: number; spanDays: number } | null {
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem(PXCACHE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.map ? d : null;
  } catch { return null; }
}
function savePxCache(map: PriceMap, ts: number, spanDays: number): void {
  try { localStorage.setItem(PXCACHE_KEY, JSON.stringify({ map, ts, spanDays })); } catch { /* private mode / kvóta */ }
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

/** ETH mostani ára (USD+HUF) — a holding-értékhez. Hiba esetén {0,0}, NEM dob:
 *  egy tranziens 429 a spot-áron NEM ejtheti el a teljes (már lekért) Overview-t. */
export async function ethSpot(): Promise<DayPrice> {
  const j = await cgGet("simple/price?ids=ethereum&vs_currencies=usd,huf");
  return { usd: j?.ethereum?.usd ?? 0, huf: j?.ethereum?.huf ?? 0 };
}
