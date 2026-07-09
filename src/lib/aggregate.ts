// Összevont watchlist-portfólió: EVM (5 lánc) + SOL + BTC egy közös nézetben.
// Watch-only, keyless. Verified/unverified szétválasztás, per-lánc ÉS per-tárca bontás.
import { Wallet } from "./wallets";
import { Asset, Portfolio, fetchPortfolio, sharedUsdHuf, capOk } from "./multichain";
import { fetchSolana } from "./solana";
import { fetchBitcoin } from "./bitcoin";

export async function fetchWatchlist(wallets: Wallet[], evmChains: string[]): Promise<Portfolio> {
  const factor = await sharedUsdHuf();
  const evm = wallets.filter((w) => w.type === "evm");
  const sol = wallets.filter((w) => w.type === "sol");
  const btc = wallets.filter((w) => w.type === "btc");

  const allAssets: Asset[] = []; // MINDEN valódi (nem-spam) token, verified flaggel
  const chainErrors: string[] = [];
  const nfts: Portfolio["nfts"] = [];
  const perWalletUsd: Record<string, number> = {};
  let nftCount = 0, dustFiltered = 0, suspiciousFiltered = 0;
  let pricingMode: "coingecko" | "allowlist" = "allowlist";

  // asset → melyik tárcához tartozik (per-wallet bontáshoz). Az EVM fetchPortfolio
  // több címet összevon, ezért az EVM-et címenként külön hívjuk a pontos bontásért.
  const tagWallet = (list: Asset[], addr: string) => {
    for (const a of list) (a as any)._w = addr;
    return list;
  };

  const jobs: Promise<void>[] = [];

  for (const w of evm) {
    jobs.push((async () => {
      const p = await fetchPortfolio([w.address], evmChains, factor);
      if (p.pricingMode === "coingecko") pricingMode = "coingecko";
      dustFiltered += p.dustFiltered;
      suspiciousFiltered += p.suspiciousFiltered;
      nftCount += p.nftCount; nfts.push(...p.nfts);
      for (const c of p.chainErrors) if (!chainErrors.includes(c)) chainErrors.push(c);
      // p.assets MÁR a teljes lista (verified + best-effort nem-verified) — a
      // suspicious/spam ott kiszűrve. Egy poolba gyűjtjük a verified flaggel.
      allAssets.push(...tagWallet(p.assets, w.address));
    })());
  }
  for (const w of sol) {
    jobs.push((async () => {
      const r = await fetchSolana(w.address, factor);
      if (r.error && !chainErrors.includes("sol")) chainErrors.push("sol");
      for (const a of r.assets) allAssets.push(Object.assign(a, { _w: w.address }));
    })());
  }
  for (const w of btc) {
    jobs.push((async () => {
      const r = await fetchBitcoin(w.address, factor);
      if (r.error && !chainErrors.includes("btc")) chainErrors.push("btc");
      for (const a of r.assets) allAssets.push(Object.assign(a, { _w: w.address }));
    })());
  }
  await Promise.all(jobs);

  const byVal = (x: Asset, y: Asset) => y.valueUsd - x.valueUsd;
  // #16/#18: a totál CSAK verified ÉS sanity-cap-ot átmenő eszközből — a SOL/BTC
  // is átmegy a KÖZÖS capOk-on (egy source of truth a multichain.ts-ből), így egy
  // CG-glitch/mispriced curated SPL sem folyhat korlátlanul a totálba.
  const inTotal = (a: Asset) => a.verified && capOk(a);
  const verified = allAssets.filter(inTotal);
  const totalUsd = verified.reduce((s, a) => s + a.valueUsd, 0);
  const perChainUsd: Record<string, number> = {};
  for (const a of verified) {
    a.allocationPct = totalUsd ? (100 * a.valueUsd) / totalUsd : 0;
    perChainUsd[a.chain] = (perChainUsd[a.chain] || 0) + a.valueUsd;
    const w = (a as any)._w as string | undefined;
    if (w) perWalletUsd[w] = (perWalletUsd[w] || 0) + a.valueUsd;
  }
  for (const a of allAssets) if (!inTotal(a)) a.allocationPct = 0;
  // cap-buktatott, egyébként verified assetek is "nem a totálban" jelzést kapnak
  const suspiciousInMerge = allAssets.filter((a) => a.verified && !capOk(a)).length;
  suspiciousFiltered += suspiciousInMerge;

  // A LISTA: minden valódi token (érték szerint) — a nem-verified is látszik.
  const list = allAssets.sort(byVal);
  const unverified = allAssets.filter((a) => !a.verified);

  return {
    addresses: wallets.map((w) => w.address),
    chains: [...new Set(list.map((a) => a.chain))],
    totalUsd, totalHuf: totalUsd * factor,
    assetCount: list.length, dustFiltered, suspiciousFiltered, usdHufFactor: factor,
    perChainUsd, perWalletUsd, pricingMode,
    assets: list, unverifiedAssets: unverified.slice(0, 60),
    nfts: nfts.slice(0, 150), nftCount, chainErrors,
  };
}
