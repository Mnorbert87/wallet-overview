// Teljes token-holdings KULCS NÉLKÜL — Blockscout REST v2 adja a token-egyenlegeket
// per-token USD `exchange_rate`-tel + a native ETH-t. A HUF-ot a CoinGecko USD→HUF
// faktorral számoljuk (egy hívás). Minden érték USD + HUF párban.
const BLOCKSCOUT = "https://eth.blockscout.com";
const CG = "https://api.coingecko.com/api/v3";
const DUST_USD = 0.01; // ez alatt / ár nélkül = spam/dust, kiszűrve

export interface Holding {
  symbol: string;
  name: string;
  contract: string;
  amount: number;
  priceUsd: number;
  valueUsd: number;
  valueHuf: number;
  allocationPct: number;
}

export interface NftItem {
  collection: string;
  tokenId: string;
  image: string | null;
}

export interface HoldingsResult {
  address: string;
  totalUsd: number;
  totalHuf: number;
  tokenCount: number;
  dustFiltered: number;
  topPct: number;
  usdHufFactor: number;
  holdings: Holding[];
  nfts: NftItem[];
  nftCount: number;
}

async function jget(url: string): Promise<any> {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Blockscout ${r.status}`);
  return r.json();
}

async function usdHufFactor(): Promise<number> {
  try {
    const j = await jget(`${CG}/simple/price?ids=ethereum&vs_currencies=usd,huf`);
    const e = j.ethereum;
    return e?.usd ? e.huf / e.usd : 372;
  } catch {
    return 372; // konzervatív fallback, ha a CoinGecko épp nem elérhető
  }
}

export async function fetchHoldings(address: string): Promise<HoldingsResult> {
  const a = address;
  const [acct, toks, nftRes, factor] = await Promise.all([
    jget(`${BLOCKSCOUT}/api/v2/addresses/${a}`),
    jget(`${BLOCKSCOUT}/api/v2/addresses/${a}/tokens?type=ERC-20`),
    jget(`${BLOCKSCOUT}/api/v2/addresses/${a}/nft?type=ERC-721%2CERC-1155`).catch(() => ({ items: [] })),
    usdHufFactor(),
  ]);

  const holdings: Holding[] = [];
  let dust = 0;

  const nativeRaw = Number(acct.coin_balance || 0);
  const nativeRate = Number(acct.exchange_rate || 0);
  const nativeAmt = nativeRaw / 1e18;
  const nativeVal = nativeAmt * nativeRate;
  if (nativeVal >= DUST_USD) {
    holdings.push({
      symbol: "ETH", name: "Ethereum", contract: "native",
      amount: nativeAmt, priceUsd: nativeRate, valueUsd: nativeVal,
      valueHuf: nativeVal * factor, allocationPct: 0,
    });
  }

  for (const it of toks.items || []) {
    const t = it.token || {};
    const dec = Number.isFinite(+t.decimals) ? +t.decimals : 18;
    const amt = Number(it.value || 0) / 10 ** dec;
    const rate = Number(t.exchange_rate || 0);
    const val = amt * rate;
    if (val < DUST_USD || rate <= 0) { dust++; continue; }
    holdings.push({
      symbol: t.symbol || "?", name: t.name || "", contract: (t.address || "").toLowerCase(),
      amount: amt, priceUsd: rate, valueUsd: val, valueHuf: val * factor, allocationPct: 0,
    });
  }

  holdings.sort((x, y) => y.valueUsd - x.valueUsd);
  const totalUsd = holdings.reduce((s, h) => s + h.valueUsd, 0);
  for (const h of holdings) h.allocationPct = totalUsd ? (100 * h.valueUsd) / totalUsd : 0;

  const nfts: NftItem[] = (nftRes.items || []).slice(0, 24).map((n: any) => ({
    collection: (n.token || {}).name || "NFT",
    tokenId: String(n.id || "").slice(0, 10),
    image: (n.metadata || {}).image_url || (n.image_url ?? null),
  }));

  return {
    address: a,
    totalUsd, totalHuf: totalUsd * factor,
    tokenCount: holdings.length, dustFiltered: dust,
    topPct: holdings.length ? holdings[0].allocationPct : 0,
    usdHufFactor: factor,
    holdings, nfts, nftCount: (nftRes.items || []).length,
  };
}
