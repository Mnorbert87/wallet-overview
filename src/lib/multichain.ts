// Multichain + multi-address token-holdings, KULCS NÉLKÜL (Blockscout per-chain).
// Ez a "best free" flagship: több cím + több lánc egy összevont portfólióban.
// Per-lánc hiba nem blokkol (graceful skip). USD az exchange_rate-ből, HUF faktorral.

export interface Chain { id: string; name: string; host: string; native: string; color: string; }

export const CHAINS: Chain[] = [
  { id: "eth", name: "Ethereum", host: "https://eth.blockscout.com", native: "ETH", color: "#627eea" },
  { id: "base", name: "Base", host: "https://base.blockscout.com", native: "ETH", color: "#0052ff" },
  { id: "arbitrum", name: "Arbitrum", host: "https://arbitrum.blockscout.com", native: "ETH", color: "#28a0f0" },
  { id: "polygon", name: "Polygon", host: "https://polygon.blockscout.com", native: "POL", color: "#8247e5" },
  { id: "gnosis", name: "Gnosis", host: "https://gnosis.blockscout.com", native: "xDAI", color: "#3e6957" },
];

const CG = "https://api.coingecko.com/api/v3";
const CG_KEY = (import.meta.env.VITE_COINGECKO_KEY as string) || "";
const DUST_USD = 0.01;

// ── SPAM-SZŰRÉS (2026-07-07, Főnök visszajelzés) ──────────────────────────────
// A cél: a VALÓDI holdingok LÁTSZÓDJANAK (a korábbi allowlist-only szűrő üresre
// vágta a listát), de a scam/airdrop-szemét NE. A spam-tokenek jellemzői:
// promo/URL-nevek, telegram-linkek, "claim/reward", unicode-trükk szimbólum,
// 0-ár/dust. Ezeket ELTÁVOLÍTJUK. A nem-spam tokenek megjelennek (értékkel);
// az ár-megbízhatóság külön flag (verified) — a headline total csak abból.
// A SZIMBÓLUMRA (ticker) fut — a ticker sosem URL/domain, ezért itt a TLD-teszt is
// biztonságos (a "yearn.finance" NÉV, nem ticker; a ticker "YFI").
const SPAM_RE =
  /(https?:\/\/|www\.|[a-z0-9-]+\.(com|io|xyz|org|net|finance|app|site|vip|top|club|pro|cash|gift)\b|t\.me|telegram|discord|claim|reward|airdrop|voucher|giveaway|bonus|\bfree\b|redeem|activate|visit|winner|congratulation|access|\brewards?\b|earn |presale|whitelist|\bnft\b\s*drop|👉|🎁|✅|🚀|💰)/i;

// #7 FIX: a NÉVRE enyhébb minta — NINCS bare domain-TLD alternáció (az dobta a
// valódi yearn.finance/YFI, Harvest, Cream, Origin.finance blue-chipeket) és nincs
// bare "access"/"earn". Csak egyértelmű promo/scam-frázisok + explicit URL-scheme.
const NAME_SPAM_RE =
  /(https?:\/\/|www\.|t\.me|telegram|discord|claim|airdrop|voucher|giveaway|\bfree\b|redeem|activate|\bvisit\b|winner|congratulation|presale|whitelist|👉|🎁|✅|🚀|💰)/i;

// Egyetlen nem-verified token, aminek a Blockscout-ára > ennyi USD-t ad, szinte
// biztosan HAMIS árú (láttunk $2.8Mrd fake pozíciót) → nem verified (kimarad a
// totálból), de a token maga látszik (mennyiséggel).
const SANITY_CAP_USD = 1_000_000;

function isSpamToken(symbol: string, name: string, rate: number, valueUsd: number): boolean {
  const s = (symbol || "").trim();
  const n = (name || "").trim();
  if (!s) return true;                                  // nincs szimbólum
  if (s.length > 24 || n.length > 60) return true;      // abszurd hosszú = szemét
  if (SPAM_RE.test(s) || NAME_SPAM_RE.test(n)) return true;  // #7: névre enyhébb minta
  // #23: NE dobjunk minden nem-ASCII szimbólumot (valódi nem-latin projekt-tokenek,
  // currency-glyph maradhat unverified). CSAK a valódi trükköket: zero-width / bidi-
  // control / Cyrillic / Greek homoglyph (pl. "ЕТН" = fake ETH).
  if (/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u0400-\u04FF\u0370-\u03FF]/.test(s)) return true;
  if (rate <= 0 || valueUsd < DUST_USD) return true;    // ár nélkül / dust
  return false;
}

// ── ÁR-MEGBÍZHATÓSÁG (kritikus, audit 2026-07-08 SHIP-BLOCKER #1) ─────────────
// A Blockscout `exchange_rate` a LONG-TAIL tokeneknél megbízhatatlan: spam-
// tokeneknek hamis árat ad (láttunk $2.8Mrd fake pozíciót + egy scam-"ETH" $34k-t),
// így a nyers összeg HAMIS. A PUSZTA SZIMBÓLUM-EGYEZÉS NEM ELÉG (pont ez volt a
// scam-"ETH" bug): egy token akkor "verified" HA, ÉS CSAK HA
//   (a) a (lánc, contract-cím) párja megegyezik egy kanonikus token-címmel, VAGY
//   (b) VAN CoinGecko-kulcs és a CoinGecko listázza a contractot.
// A native coinok (ETH/xDAI/…) a NATIVE ágon kapnak verified-et, NEM ERC-20-ként;
// egy "ETH" SZIMBÓLUMÚ, DE contract-címmel bíró token tehát megbízhatatlan, hacsak
// a címe nem a kanonikus WETH-cím. Így SOHA nem mutatunk felfújt hamis összeget.

// Kanonikus token-címek: SYMBOL → { chainId → lowercase contract }. Hivatalos címek.
// (Az "ETH" kulcs a WETH-címekre mutat: egy contract-os "ETH" csak akkor verified,
//  ha ténylegesen a WETH contract — különben scam.)
const CANONICAL_RAW: Record<string, Partial<Record<string, string>>> = {
  USDC: {
    eth: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    base: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    arbitrum: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    polygon: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    gnosis: "0x2a22f9c3b484c3629090feed35f17ff8f88f76f0",
  },
  USDT: {
    eth: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    base: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
    arbitrum: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    polygon: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
    gnosis: "0x4ecaba5870353805a9f068101a40e0f32ed605c6",
  },
  DAI: {
    eth: "0x6b175474e89094c44da98b954eedeac495271d0f",
    base: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
    arbitrum: "0xda10009cbd5d07dd0cef1f9df3a7b4e5c1cb2782",
    polygon: "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063",
  },
  WETH: {
    eth: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    base: "0x4200000000000000000000000000000000000006",
    arbitrum: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    polygon: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
    gnosis: "0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1",
  },
  WBTC: {
    eth: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    arbitrum: "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f",
    polygon: "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6",
    gnosis: "0x8e5bbbb09ed1ebde8674cda39a0c169401db4252",
  },
  WPOL: { polygon: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270" },
  WMATIC: { polygon: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270" },
  WXDAI: { gnosis: "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d" },
};
// "ETH" szimbólum → a WETH-címekre (contract-os "ETH" csak a valódi WETH-en verified).
CANONICAL_RAW.ETH = { ...CANONICAL_RAW.WETH };

// Normalizált (lowercase) kanonikus map felépítése betöltéskor.
const CANONICAL: Record<string, Record<string, string>> = {};
for (const [sym, chainMap] of Object.entries(CANONICAL_RAW)) {
  CANONICAL[sym] = {};
  for (const [ch, addr] of Object.entries(chainMap)) if (addr) CANONICAL[sym][ch] = addr.toLowerCase();
}

/** verified feltétel (a): a (symbol, chain, contract) egyezik egy kanonikus token-címmel. */
function contractMatchesCanonical(symbol: string, chainId: string, address: string): boolean {
  const a = (address || "").toLowerCase();
  if (!a || a === "native") return false;
  const canon = CANONICAL[(symbol || "").toUpperCase()];
  return !!canon && canon[chainId] === a;
}
function isCanonicalAsset(a: Asset): boolean {
  return contractMatchesCanonical(a.symbol, a.chain, a.contract);
}

// #16/#18: sanity-cap invariáns — EGY source of truth (EVM + SOL + BTC ugyanezt
// használja az aggregate.ts-ben). Egy eszköz értéke csak akkor számít a totálba,
// ha native VAGY kanonikus contract VAGY az értéke a józan plafon alatt van.
export const SANITY_CAP = SANITY_CAP_USD;
export function capOk(a: Asset): boolean {
  return a.contract === "native" || isCanonicalAsset(a) || a.valueUsd <= SANITY_CAP_USD;
}

/** CoinGecko platform-slug a token_price kereszt-ellenőrzéshez. */
const CG_PLATFORM: Record<string, string> = {
  eth: "ethereum", base: "base", arbitrum: "arbitrum-one",
  polygon: "polygon-pos", gnosis: "xdai",
};

export interface Asset {
  symbol: string; name: string; contract: string; chain: string; chainName: string; chainColor: string;
  amount: number; priceUsd: number; valueUsd: number; valueHuf: number; allocationPct: number;
  verified: boolean; // az ár megbízható forrásból (allowlist v. CoinGecko)
}
export interface Nft { collection: string; tokenId: string; image: string | null; chain: string; }
export interface Portfolio {
  addresses: string[]; chains: string[];
  totalUsd: number; totalHuf: number; assetCount: number; dustFiltered: number;
  suspiciousFiltered: number; // hamis-árú (nem-verified, > sanity cap) — kiszűrve
  usdHufFactor: number; perChainUsd: Record<string, number>;
  perWalletUsd?: Record<string, number>; // cím → verified USD (per-tárca bontás)
  pricingMode: "coingecko" | "allowlist"; // hogyan ellenőriztük az árat
  assets: Asset[];           // MINDEN valódi (nem-spam) token — verified + best-effort
  unverifiedAssets: Asset[]; // nem ellenőrzött árú tokenek (a listában látszanak, NEM a totálban)
  nfts: Nft[]; nftCount: number;
  chainErrors: string[];
}

// Lánc-meta lookup (EVM + SOL + BTC) a UI-badge-ekhez / allokáció-sávhoz.
export const CHAIN_META: Record<string, { name: string; color: string }> = {
  ...Object.fromEntries(CHAINS.map((c) => [c.id, { name: c.name, color: c.color }])),
  sol: { name: "Solana", color: "#14f195" },
  btc: { name: "Bitcoin", color: "#f7931a" },
};

export async function sharedUsdHuf(): Promise<number> { return usdHuf(); }

async function jget(url: string, ms = 15000, headers: Record<string, string> = {}): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: ctrl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

// CoinGecko Demo-kulcs MINDIG HEADER-ben (soha URL query-ben: Referer/history-leak, audit #9).
function cgHeaders(): Record<string, string> {
  return CG_KEY ? { "x-cg-demo-api-key": CG_KEY } : {};
}

// jget kis retry/backoff-fal (429/timeout ellen). Végső hiba → feldobja (fail-closed a hívónál).
async function jgetRetry(url: string, ms: number, headers: Record<string, string> = {}, retries = 2): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try { return await jget(url, ms, headers); }
    catch (e) {
      if (attempt >= retries) throw e;
      await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
    }
  }
}

// Blockscout v2 lapozás: next_page_params-ot query-vé fűzve, cap oldalig. Sosem dob
// (részleges lap is jobb mint 0): egy oldal-hiba → az addig gyűjtött itemekkel tér vissza.
async function fetchAllPages(baseUrl: string, cap = 8): Promise<any[]> {
  const items: any[] = [];
  let params: Record<string, any> | null = null;
  for (let page = 0; page < cap; page++) {
    let url = baseUrl;
    if (params) {
      const qp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v != null) qp.set(k, String(v));
      url += (baseUrl.includes("?") ? "&" : "?") + qp.toString();
    }
    let j: any;
    try { j = await jget(url); } catch { break; }
    if (Array.isArray(j?.items)) items.push(...j.items);
    params = (j && j.next_page_params) || null;
    if (!params) break;
  }
  return items;
}

async function usdHuf(): Promise<number> {
  try {
    const j = await jget(`${CG}/simple/price?ids=ethereum&vs_currencies=usd,huf`, 8000, cgHeaders());
    return j.ethereum?.usd ? j.ethereum.huf / j.ethereum.usd : 372;
  } catch { return 372; }
}

async function chainAssets(addr: string, chain: Chain, factor: number): Promise<{ assets: Asset[]; nfts: Nft[]; nftCount: number; dust: number }> {
  // KÜLÖN hibakezelés fetch-enként (audit #5): a token-endpoint 429-e NE dobja el a
  // lánc native-egyenlegét. Az account külön try/catch-el, a token/NFT lapozók sosem
  // dobnak (részleges lap is jobb mint 0). Így egy endpoint hibája nem visz mindent.
  const [acct, tokItems, nftItems] = await Promise.all([
    // #28: a native balance-fetch RETRY-vel — 1 db 429 ne dobja a lánc legértékesebb
    // eszközét (native coin). Izoláció megmarad (.catch → üres, nem blokkol).
    jgetRetry(`${chain.host}/api/v2/addresses/${addr}`, 15000, {}, 2).catch(() => ({} as any)),
    fetchAllPages(`${chain.host}/api/v2/addresses/${addr}/tokens?type=ERC-20`, 8),
    fetchAllPages(`${chain.host}/api/v2/addresses/${addr}/nft?type=ERC-721%2CERC-1155`, 6),
  ]);
  const assets: Asset[] = [];
  let dust = 0;
  const mk = (symbol: string, name: string, contract: string, amount: number, rate: number, verified: boolean): Asset => ({
    symbol, name, contract, chain: chain.id, chainName: chain.name, chainColor: chain.color,
    amount, priceUsd: rate, valueUsd: amount * rate, valueHuf: amount * rate * factor, allocationPct: 0, verified,
  });
  const nAmt = Number(acct.coin_balance || 0) / 1e18;
  const nRate = Number(acct.exchange_rate || 0);
  // A native coin ára megbízható (a lánc alap-eszköze) → mindig verified.
  if (nAmt * nRate >= DUST_USD) assets.push(mk(chain.native, chain.name + " " + chain.native, "native", nAmt, nRate, true));
  for (const it of tokItems) {
    const t = it.token || {};
    const dec = Number.isFinite(+t.decimals) ? +t.decimals : 18;
    const amt = Number(it.value || 0) / 10 ** dec;
    const rate = Number(t.exchange_rate || 0);
    const valueUsd = amt * rate;
    const sym = (t.symbol || "").trim();
    const address = (t.address || "").toLowerCase();
    // 1) SPAM/dust → teljesen eldobjuk (promo-nevek, unicode-trükk, 0-ár, dust)
    if (isSpamToken(sym, t.name || "", rate, valueUsd)) { dust++; continue; }
    // 2) Nem-spam token → MEGJELENIK a listában. Az ÁR megbízhatósága (verified)
    //    KÜLÖN kérdés (audit #1 SHIP-BLOCKER): NEM a szimbólum, hanem a (lánc,
    //    contract-cím) párja kell egyezzen egy kanonikus token-címmel. A puszta
    //    szimbólum-egyezés (a régi scam-"ETH" bug forrása) NEM elég. CoinGecko-
    //    kulccsal a crossCheck a listázott contractokat is verifikálja.
    //    A headline total CSAK a verified tokenekből → nincs felfújt hamis összeg;
    //    a nem-verified tokenek is MEGJELENNEK a listában (érték best-effort, "≈").
    const verified = contractMatchesCanonical(sym, chain.id, address);
    assets.push(mk(sym || "?", t.name || "", address, amt, rate, verified));
  }
  const nfts: Nft[] = nftItems.slice(0, 40).map((n: any) => ({
    collection: (n.token || {}).name || "NFT", tokenId: String(n.id || "").slice(0, 8),
    image: (n.metadata || {}).image_url || (n.image_url ?? null), chain: chain.id,
  }));
  return { assets, nfts, nftCount: nftItems.length, dust };
}

export async function fetchPortfolio(addresses: string[], chainIds: string[], factorIn?: number): Promise<Portfolio> {
  // #17: az FX-faktort a hívó átfűzheti (aggregate), hogy ne kérjük wallet-enként
  // újra (N+1 CoinGecko-hívás → rate-limit → HUF-inkonzisztencia).
  const factor = factorIn ?? await usdHuf();
  const chains = CHAINS.filter((c) => chainIds.includes(c.id));
  const jobs: Promise<{ ok: boolean; chain: string } & any>[] = [];
  for (const addr of addresses) for (const c of chains) {
    jobs.push(
      chainAssets(addr, c, factor).then((r) => ({ ok: true, chain: c.id, ...r }))
        .catch(() => ({ ok: false, chain: c.id, assets: [], nfts: [], nftCount: 0, dust: 0 })),
    );
  }
  const results = await Promise.all(jobs);

  const assets: Asset[] = [];
  const nfts: Nft[] = [];
  const perChainUsd: Record<string, number> = {};
  const chainErrors: string[] = [];
  let dustFiltered = 0, nftCount = 0;
  for (const r of results) {
    if (!r.ok) { if (!chainErrors.includes(r.chain)) chainErrors.push(r.chain); continue; }
    assets.push(...r.assets); nfts.push(...r.nfts); nftCount += r.nftCount; dustFiltered += r.dust;
  }
  // azonos (contract+chain) tételek összevonása több cím esetén
  const merged = new Map<string, Asset>();
  for (const a of assets) {
    const k = `${a.chain}:${a.contract}:${a.symbol}`;
    const e = merged.get(k);
    if (e) { e.amount += a.amount; e.valueUsd += a.valueUsd; e.valueHuf += a.valueHuf; }
    else merged.set(k, { ...a });
  }
  const allAssets = [...merged.values()];

  // Keyless (nincs CG-kulcs): verified = CSAK kanonikus (lánc, contract) egyezés.
  // CG-kulccsal: batch kereszt-ellenőrzés — verified ha a CoinGecko listázza a
  // contractot (vagy kanonikus). A "allowlist" literál a keyless módot jelöli a UI-nak.
  let pricingMode: "coingecko" | "allowlist" = "allowlist";
  if (CG_KEY) {
    pricingMode = "coingecko";
    await crossCheckCoinGecko(allAssets, factor);
  }

  const byVal = (x: Asset, y: Asset) => y.valueUsd - x.valueUsd;
  // A sanity-cap MINDEN ágon fut (audit #2): egy spoofolt "USDC" NE ugorhassa át a
  // ha valamiért verified lett. Kivétel: native coin (megbízható lánc-ár) ÉS a
  // kanonikus contractú token (valódi whale-USDC lehet nagyobb a cap-nél).
  const verified = allAssets.filter((a) => a.verified && capOk(a)).sort(byVal);
  // Nem-verified, de ÉPESZŰ értékű tokenek → a listában látszanak (best-effort árral).
  const unverifiedReal = allAssets.filter((a) => !a.verified && a.valueUsd <= SANITY_CAP_USD).sort(byVal);
  // Abszurd érték (> sanity cap) + nem kanonikus/native = szinte biztosan HAMIS ár →
  // kiszűrve, akár verified volt, akár nem (spoof-védelem mindkét ágon).
  const suspiciousFiltered = allAssets.filter((a) => !capOk(a)).length;

  const totalUsd = verified.reduce((s, a) => s + a.valueUsd, 0);
  for (const a of verified) {
    a.allocationPct = totalUsd ? (100 * a.valueUsd) / totalUsd : 0;
    perChainUsd[a.chain] = (perChainUsd[a.chain] || 0) + a.valueUsd;
  }
  for (const a of unverifiedReal) a.allocationPct = 0; // nincs a totálban → nincs allokáció-%

  // A LISTA: minden valódi token (verified elöl, majd best-effort), érték szerint.
  const list = [...verified, ...unverifiedReal].sort(byVal);
  return {
    addresses, chains: chainIds, totalUsd, totalHuf: totalUsd * factor,
    assetCount: list.length, dustFiltered, suspiciousFiltered, usdHufFactor: factor, perChainUsd, pricingMode,
    assets: list, unverifiedAssets: unverifiedReal.slice(0, 40), nfts: nfts.slice(0, 150), nftCount, chainErrors,
  };
}

/** CoinGecko batch token-ár kereszt-ellenőrzés (Demo-kulccsal, 100 contract/hívás).
 *  A CoinGecko-kulcs MINDIG headerben megy (audit #9, soha URL query-ben).
 *  Ami a CG-n listázva van → verified + pontos ár. Ami nincs / hibára fut (429) →
 *  FAIL-CLOSED (audit #3): verified marad IGAZ csak ha a contract kanonikus, különben
 *  false. Így egy rate-limit NEM hagy egy scam-tokent tévesen verifikáltnak. */
async function crossCheckCoinGecko(assets: Asset[], factor: number): Promise<void> {
  const byChain = new Map<string, Asset[]>();
  for (const a of assets) {
    if (a.contract === "native") continue; // native már verified
    (byChain.get(a.chain) || byChain.set(a.chain, []).get(a.chain)!).push(a);
  }
  for (const [chain, list] of byChain) {
    const platform = CG_PLATFORM[chain];
    if (!platform) { for (const a of list) a.verified = isCanonicalAsset(a); continue; }
    for (let i = 0; i < list.length; i += 100) {
      const batch = list.slice(i, i + 100);
      const addrs = batch.map((a) => a.contract).join(",");
      try {
        const j = await jgetRetry(
          `${CG}/simple/token_price/${platform}?contract_addresses=${addrs}&vs_currencies=usd`,
          12000, cgHeaders(),
        );
        for (const a of batch) {
          const px = j[a.contract]?.usd;
          if (typeof px === "number" && px > 0) {
            a.priceUsd = px; a.valueUsd = a.amount * px; a.valueHuf = a.valueUsd * factor; a.verified = true;
          } else { a.verified = isCanonicalAsset(a); } // nem listázott → csak kanonikus marad verified
        }
      } catch { for (const a of batch) a.verified = isCanonicalAsset(a); } // 429/hiba → FAIL-CLOSED
    }
  }
}

// ENS → cím feloldás (keyless, ensdata.net). Cím-visszafelé is: cím → ens név.
export async function resolveInput(raw: string): Promise<{ address: string | null; ens: string | null }> {
  const s = raw.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(s)) {
    try { const d = await jget(`https://api.ensdata.net/${s}`, 6000); return { address: s, ens: d.ens || d.name || null }; }
    catch { return { address: s, ens: null }; }
  }
  if (/\.eth$/i.test(s)) {
    try { const d = await jget(`https://api.ensdata.net/${s}`, 6000); return { address: (d.address || null), ens: s }; }
    catch { return { address: null, ens: s }; }
  }
  return { address: null, ens: null };
}
