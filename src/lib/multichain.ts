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

// ── ÁR-MEGBÍZHATÓSÁG (kritikus, audit 2026-07-07) ─────────────────────────────
// A Blockscout `exchange_rate` a LONG-TAIL tokeneknél megbízhatatlan: spam-
// tokeneknek hamis árat ad (láttunk $2.8Mrd fake pozíciót), így a nyers összeg
// HAMIS. Nem trükközünk: a headline-értéket CSAK megbízható árforrásból számoljuk.
//   1) VAN CoinGecko-kulcs (VITE_COINGECKO_KEY, ingyenes Demo): batch kereszt-
//      ellenőrzés — a token USD-értéke csak akkor számít, ha a CoinGecko listázza
//      a contractot (a spam nem listázott → 0). Teljes, pontos, spam-mentes.
//   2) NINCS kulcs (keyless): CSAK a curated allowlist (valódi likvid tokenek) +
//      native számít a headline-be; a többi token "árazás nem ellenőrzött"
//      szekcióba kerül, $0 a totálban — SOHA nem mutatunk felfújt hamis összeget.
const ALLOWLIST = new Set([
  // stablecoinok + native + wrapped
  "ETH", "WETH", "WBTC", "USDC", "USDT", "DAI", "USDC.E", "USDBC", "USDS", "USDE",
  "SUSDE", "FRAX", "LUSD", "GHO", "PYUSD", "TUSD", "USDD", "CRVUSD", "FDUSD",
  "POL", "MATIC", "WPOL", "WMATIC", "ARB", "OP", "XDAI", "WXDAI", "GNO", "BNB",
  "CBETH", "WSTETH", "STETH", "RETH", "WEETH", "EETH", "EZETH", "RSETH", "PAXG", "XAUT",
  // blue-chip DeFi + likvid alts (a Binance-teszt valódi tokenjei)
  "LINK", "UNI", "AAVE", "MKR", "SNX", "COMP", "CRV", "LDO", "BAL", "SUSHI", "1INCH",
  "PEPE", "SHIB", "ONDO", "ENA", "EIGEN", "WLD", "PENDLE", "AXS", "SAND", "MANA",
  "GRT", "IMX", "RENDER", "INJ", "FET", "STG", "ZRO", "PORTAL", "ID", "NMR", "BNT",
  "GLM", "PHA", "AMP", "AXL", "APE", "BLUR", "ENS", "CVX", "FXS", "RPL", "SPELL",
  "DYDX", "GMX", "MAGIC", "RDNT", "PENGU", "MOG", "TURBO", "NEIRO", "FLOKI",
]);

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
  usdHufFactor: number; perChainUsd: Record<string, number>;
  pricingMode: "coingecko" | "allowlist"; // hogyan ellenőriztük az árat
  assets: Asset[];           // VERIFIED — ezek adják a headline totált
  unverifiedAssets: Asset[]; // nem ellenőrzött árú tokenek (NEM a totálban)
  nfts: Nft[]; nftCount: number;
  chainErrors: string[];
}

async function jget(url: string, ms = 15000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

async function usdHuf(): Promise<number> {
  try {
    const j = await jget(`${CG}/simple/price?ids=ethereum&vs_currencies=usd,huf`, 8000);
    return j.ethereum?.usd ? j.ethereum.huf / j.ethereum.usd : 372;
  } catch { return 372; }
}

async function chainAssets(addr: string, chain: Chain, factor: number): Promise<{ assets: Asset[]; nfts: Nft[]; nftCount: number; dust: number }> {
  const [acct, toks, nftRes] = await Promise.all([
    jget(`${chain.host}/api/v2/addresses/${addr}`),
    jget(`${chain.host}/api/v2/addresses/${addr}/tokens?type=ERC-20`),
    jget(`${chain.host}/api/v2/addresses/${addr}/nft?type=ERC-721%2CERC-1155`).catch(() => ({ items: [] })),
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
  for (const it of toks.items || []) {
    const t = it.token || {};
    const dec = Number.isFinite(+t.decimals) ? +t.decimals : 18;
    const amt = Number(it.value || 0) / 10 ** dec;
    const rate = Number(t.exchange_rate || 0);
    if (amt * rate < DUST_USD || rate <= 0) { dust++; continue; }
    // keyless verified = az allowlisten szereplő valódi likvid token (a spam nem az).
    // CoinGecko-kulccsal ezt később felülírja a batch kereszt-ellenőrzés.
    const verified = ALLOWLIST.has((t.symbol || "").toUpperCase());
    assets.push(mk(t.symbol || "?", t.name || "", (t.address || "").toLowerCase(), amt, rate, verified));
  }
  const nfts: Nft[] = (nftRes.items || []).slice(0, 12).map((n: any) => ({
    collection: (n.token || {}).name || "NFT", tokenId: String(n.id || "").slice(0, 8),
    image: (n.metadata || {}).image_url || (n.image_url ?? null), chain: chain.id,
  }));
  return { assets, nfts, nftCount: (nftRes.items || []).length, dust };
}

export async function fetchPortfolio(addresses: string[], chainIds: string[]): Promise<Portfolio> {
  const factor = await usdHuf();
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

  // CoinGecko-kulcs esetén: batch kereszt-ellenőrzés — a token USD-értéke csak
  // akkor "verified", ha a CoinGecko listázza a contractot (spam → nem listázott).
  let pricingMode: "coingecko" | "allowlist" = "allowlist";
  if (CG_KEY) {
    pricingMode = "coingecko";
    await crossCheckCoinGecko(allAssets, factor);
  }

  const verified = allAssets.filter((a) => a.verified).sort((x, y) => y.valueUsd - x.valueUsd);
  const unverified = allAssets.filter((a) => !a.verified).sort((x, y) => y.valueUsd - x.valueUsd);
  const totalUsd = verified.reduce((s, a) => s + a.valueUsd, 0);
  for (const a of verified) {
    a.allocationPct = totalUsd ? (100 * a.valueUsd) / totalUsd : 0;
    perChainUsd[a.chain] = (perChainUsd[a.chain] || 0) + a.valueUsd;
  }
  return {
    addresses, chains: chainIds, totalUsd, totalHuf: totalUsd * factor,
    assetCount: verified.length, dustFiltered, usdHufFactor: factor, perChainUsd, pricingMode,
    assets: verified, unverifiedAssets: unverified.slice(0, 40), nfts: nfts.slice(0, 24), nftCount, chainErrors,
  };
}

/** CoinGecko batch token-ár kereszt-ellenőrzés (Demo-kulccsal, 100 contract/hívás).
 *  Minden asset ára a CoinGecko-ra íródik felül; ami nincs listázva → verified=false. */
async function crossCheckCoinGecko(assets: Asset[], factor: number): Promise<void> {
  const byChain = new Map<string, Asset[]>();
  for (const a of assets) {
    if (a.contract === "native") continue; // native már verified
    (byChain.get(a.chain) || byChain.set(a.chain, []).get(a.chain)!).push(a);
  }
  for (const [chain, list] of byChain) {
    const platform = CG_PLATFORM[chain];
    if (!platform) { for (const a of list) a.verified = false; continue; }
    for (let i = 0; i < list.length; i += 100) {
      const batch = list.slice(i, i + 100);
      const addrs = batch.map((a) => a.contract).join(",");
      try {
        const j = await jget(`${CG}/simple/token_price/${platform}?contract_addresses=${addrs}&vs_currencies=usd&x_cg_demo_api_key=${CG_KEY}`, 12000);
        for (const a of batch) {
          const px = j[a.contract]?.usd;
          if (typeof px === "number" && px > 0) {
            a.priceUsd = px; a.valueUsd = a.amount * px; a.valueHuf = a.valueUsd * factor; a.verified = true;
          } else { a.verified = false; } // nem listázott = nem ellenőrzött árú
        }
      } catch { for (const a of batch) a.verified = a.verified; } // hiba → marad az allowlist-döntés
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
