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
const DUST_USD = 0.01;
// Spam-ár guard: a Blockscout exchange_rate spam-tokeneknél hamisan felfújható
// (láttunk $800M+ fake pozíciót). Egy nem-major token egyetlen pozíciója
// SPAM_CAP fölött szinte biztos hamis árazás → kiszűrjük ("gyanús árazás").
// A majorok (valódi likvid tokenek) whitelistelve, rájuk nincs cap.
const SPAM_CAP_USD = 1_000_000;
const MAJORS = new Set([
  "ETH", "WETH", "USDC", "USDT", "DAI", "WBTC", "cbETH", "wstETH", "stETH", "rETH",
  "POL", "MATIC", "WPOL", "ARB", "OP", "xDAI", "WXDAI", "GNO", "LINK", "UNI", "AAVE",
  "USDC.e", "USDbC", "BAL", "CRV", "LDO", "MKR", "SNX", "COMP", "FRAX", "USDe", "sUSDe",
]);

export interface Asset {
  symbol: string; name: string; contract: string; chain: string; chainName: string; chainColor: string;
  amount: number; priceUsd: number; valueUsd: number; valueHuf: number; allocationPct: number;
}
export interface Nft { collection: string; tokenId: string; image: string | null; chain: string; }
export interface Portfolio {
  addresses: string[]; chains: string[];
  totalUsd: number; totalHuf: number; assetCount: number; dustFiltered: number;
  spamFiltered: number;
  usdHufFactor: number; perChainUsd: Record<string, number>;
  assets: Asset[]; nfts: Nft[]; nftCount: number;
  chainErrors: string[];
}

function isSuspiciousPrice(a: Asset): boolean {
  return a.valueUsd > SPAM_CAP_USD && !MAJORS.has(a.symbol.toUpperCase());
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
  const mk = (symbol: string, name: string, contract: string, amount: number, rate: number): Asset => ({
    symbol, name, contract, chain: chain.id, chainName: chain.name, chainColor: chain.color,
    amount, priceUsd: rate, valueUsd: amount * rate, valueHuf: amount * rate * factor, allocationPct: 0,
  });
  const nAmt = Number(acct.coin_balance || 0) / 1e18;
  const nRate = Number(acct.exchange_rate || 0);
  if (nAmt * nRate >= DUST_USD) assets.push(mk(chain.native, chain.name + " " + chain.native, "native", nAmt, nRate));
  for (const it of toks.items || []) {
    const t = it.token || {};
    const dec = Number.isFinite(+t.decimals) ? +t.decimals : 18;
    const amt = Number(it.value || 0) / 10 ** dec;
    const rate = Number(t.exchange_rate || 0);
    if (amt * rate < DUST_USD || rate <= 0) { dust++; continue; }
    assets.push(mk(t.symbol || "?", t.name || "", (t.address || "").toLowerCase(), amt, rate));
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
  // azonos (symbol+chain) tételek összevonása több cím esetén
  const merged = new Map<string, Asset>();
  for (const a of assets) {
    const k = `${a.chain}:${a.contract}:${a.symbol}`;
    const e = merged.get(k);
    if (e) { e.amount += a.amount; e.valueUsd += a.valueUsd; e.valueHuf += a.valueHuf; }
    else merged.set(k, { ...a });
  }
  // spam-ár guard: gyanús árazású nem-major pozíciók kiszűrése
  const all = [...merged.values()];
  const spamFiltered = all.filter(isSuspiciousPrice).length;
  const list = all.filter((a) => !isSuspiciousPrice(a)).sort((x, y) => y.valueUsd - x.valueUsd);
  const totalUsd = list.reduce((s, a) => s + a.valueUsd, 0);
  for (const a of list) {
    a.allocationPct = totalUsd ? (100 * a.valueUsd) / totalUsd : 0;
    perChainUsd[a.chain] = (perChainUsd[a.chain] || 0) + a.valueUsd;
  }
  return {
    addresses, chains: chainIds, totalUsd, totalHuf: totalUsd * factor,
    assetCount: list.length, dustFiltered, spamFiltered, usdHufFactor: factor, perChainUsd,
    assets: list, nfts: nfts.slice(0, 24), nftCount, chainErrors,
  };
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
