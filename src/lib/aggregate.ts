// Összevont watchlist-portfólió: EVM (5 lánc) + SOL + BTC egy közös nézetben.
// Watch-only, keyless. Verified/unverified szétválasztás, per-lánc ÉS per-tárca bontás.
import { Wallet } from "./wallets";
import { Asset, Portfolio, fetchPortfolio, sharedUsdHuf } from "./multichain";
import { fetchSolana } from "./solana";
import { fetchBitcoin } from "./bitcoin";

export async function fetchWatchlist(wallets: Wallet[], evmChains: string[]): Promise<Portfolio> {
  const factor = await sharedUsdHuf();
  const evm = wallets.filter((w) => w.type === "evm");
  const sol = wallets.filter((w) => w.type === "sol");
  const btc = wallets.filter((w) => w.type === "btc");

  const assets: Asset[] = [];
  const unverified: Asset[] = [];
  const chainErrors: string[] = [];
  const nfts: Portfolio["nfts"] = [];
  const perWalletUsd: Record<string, number> = {};
  let nftCount = 0, dustFiltered = 0;
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
      const p = await fetchPortfolio([w.address], evmChains);
      if (p.pricingMode === "coingecko") pricingMode = "coingecko";
      dustFiltered += p.dustFiltered;
      nftCount += p.nftCount; nfts.push(...p.nfts);
      for (const c of p.chainErrors) if (!chainErrors.includes(c)) chainErrors.push(c);
      assets.push(...tagWallet(p.assets, w.address));
      unverified.push(...tagWallet(p.unverifiedAssets, w.address));
    })());
  }
  for (const w of sol) {
    jobs.push((async () => {
      const r = await fetchSolana(w.address, factor);
      if (r.error && !chainErrors.includes("sol")) chainErrors.push("sol");
      for (const a of r.assets) (a.verified ? assets : unverified).push(Object.assign(a, { _w: w.address }));
    })());
  }
  for (const w of btc) {
    jobs.push((async () => {
      const r = await fetchBitcoin(w.address, factor);
      if (r.error && !chainErrors.includes("btc")) chainErrors.push("btc");
      for (const a of r.assets) (a.verified ? assets : unverified).push(Object.assign(a, { _w: w.address }));
    })());
  }
  await Promise.all(jobs);

  const verified = assets.sort((x, y) => y.valueUsd - x.valueUsd);
  const totalUsd = verified.reduce((s, a) => s + a.valueUsd, 0);
  const perChainUsd: Record<string, number> = {};
  for (const a of verified) {
    a.allocationPct = totalUsd ? (100 * a.valueUsd) / totalUsd : 0;
    perChainUsd[a.chain] = (perChainUsd[a.chain] || 0) + a.valueUsd;
    const w = (a as any)._w as string | undefined;
    if (w) perWalletUsd[w] = (perWalletUsd[w] || 0) + a.valueUsd;
  }

  return {
    addresses: wallets.map((w) => w.address),
    chains: [...new Set(verified.map((a) => a.chain))],
    totalUsd, totalHuf: totalUsd * factor,
    assetCount: verified.length, dustFiltered, usdHufFactor: factor,
    perChainUsd, perWalletUsd, pricingMode,
    assets: verified, unverifiedAssets: unverified.slice(0, 60),
    nfts: nfts.slice(0, 24), nftCount, chainErrors,
  };
}
