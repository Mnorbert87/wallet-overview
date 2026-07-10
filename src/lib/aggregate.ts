// Összevont watchlist-portfólió: EVM (5 lánc) + SOL + BTC egy közös nézetben.
// Watch-only, keyless. Verified/unverified szétválasztás, per-lánc ÉS per-tárca bontás.
import { Wallet } from "./wallets";
import { Asset, Portfolio, fetchPortfolio, sharedUsdHuf, capOk, SANITY_CAP, HAS_CG_KEY, crossCheckCoinGecko } from "./multichain";
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
  let holdingsTruncated = false; // #WO-6: bármely EVM tárca lapozás-cap-be ütközött?
  let pricingMode: "coingecko" | "allowlist" = "allowlist";

  // asset → melyik tárcához tartozik (per-wallet bontáshoz). Az EVM fetchPortfolio
  // több címet összevon, ezért az EVM-et címenként külön hívjuk a pontos bontásért.
  const tagWallet = (list: Asset[], addr: string) => {
    for (const a of list) (a as any)._w = addr;
    return list;
  };

  const jobs: Promise<void>[] = [];

  const evmAssets: Asset[] = []; // #WO-9: EVM asset-instance-ok a merged CG-batch-hez
  for (const w of evm) {
    jobs.push((async () => {
      // #WO-9: a per-wallet fetch NEM futtat külön CG kereszt-ellenőrzést (skipCrossCheck),
      // hogy ne legyen N külön batch (N×429-kockázat). EGY merged batch fut lentebb.
      const p = await fetchPortfolio([w.address], evmChains, factor, true);
      if (p.pricingMode === "coingecko") pricingMode = "coingecko";
      if (p.holdingsTruncated) holdingsTruncated = true;
      dustFiltered += p.dustFiltered;
      suspiciousFiltered += p.suspiciousFiltered;
      nftCount += p.nftCount; nfts.push(...p.nfts);
      for (const c of p.chainErrors) if (!chainErrors.includes(c)) chainErrors.push(c);
      // p.assets MÁR a teljes lista (verified + best-effort nem-verified) — a
      // suspicious/spam ott kiszűrve. Egy poolba gyűjtjük a verified flaggel.
      const tagged = tagWallet(p.assets, w.address);
      allAssets.push(...tagged);
      for (const a of tagged) if (a.contract !== "native") evmAssets.push(a);
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

  // #WO-9: EGYETLEN CG kereszt-ellenőrzés a több tárca UNION-jén (a per-wallet fetchek
  // skipCrossCheck-kel futottak). Dedup (chain,contract)-onként egy reprezentánsra, majd
  // az eredményt (verified/priceUsd/valueUsd) VISSZAÍRJUK minden azonos-token instance-ra.
  // Így 1 batch/lánc a sok kis batch helyett → jóval kisebb 429-kockázat, a fail-closed
  // szemantika változatlan.
  if (HAS_CG_KEY && evmAssets.length) {
    const groups = new Map<string, Asset[]>();
    for (const a of evmAssets) {
      const k = `${a.chain}:${a.contract}`;
      (groups.get(k) || groups.set(k, []).get(k)!).push(a);
    }
    const reps = [...groups.values()].map((g) => g[0]);
    await crossCheckCoinGecko(reps, factor);
    for (const g of groups.values()) {
      const rep = g[0];
      for (const a of g) {
        if (a === rep) continue;
        a.verified = rep.verified;
        a.priceUsd = rep.priceUsd;
        a.valueUsd = a.amount * rep.priceUsd;
        a.valueHuf = a.valueUsd * factor;
      }
    }
  }

  const byVal = (x: Asset, y: Asset) => y.valueUsd - x.valueUsd;
  // #16/#18: a totál CSAK verified ÉS sanity-cap-ot átmenő eszközből — a SOL/BTC
  // is átmegy a KÖZÖS capOk-on (egy source of truth a multichain.ts-ből), így egy
  // CG-glitch/mispriced curated SPL sem folyhat korlátlanul a totálba.
  const inTotal = (a: Asset) => a.verified && capOk(a);
  const verified = allAssets.filter(inTotal);
  const totalUsd = verified.reduce((s, a) => s + a.valueUsd, 0);
  const perChainUsd: Record<string, number> = {};
  // NATIVE-CAP jelzés (lásd multichain.ts): a native coin nem esik ki a totálból,
  // de ha > sanity cap, "szokatlanul nagy, ellenőrizd" flaget kap — hogy egy valós,
  // de milliárdos native total (whale/csere-tárca/decimals-hiba) ne látsszon jelöletlen igazságnak.
  let oversizedNativeUsd = 0;
  for (const a of verified) {
    a.allocationPct = totalUsd ? (100 * a.valueUsd) / totalUsd : 0;
    perChainUsd[a.chain] = (perChainUsd[a.chain] || 0) + a.valueUsd;
    if (a.contract === "native" && a.valueUsd > SANITY_CAP) { a.oversized = true; oversizedNativeUsd += a.valueUsd; }
    const w = (a as any)._w as string | undefined;
    if (w) perWalletUsd[w] = (perWalletUsd[w] || 0) + a.valueUsd;
  }
  // #WO-8: az "üres" és a "nem-árazott" tárcát meg kell különböztetni a UI-nak.
  // walletsWithAssets = van legalább egy (akár unverified) eszköze. Az ilyen, de
  // perWalletUsd-nélküli tárca "ár n/a" (nem $0), a valóban üres tárca $0.
  const walletsWithAssets = new Set<string>();
  for (const a of allAssets) {
    const w = (a as any)._w as string | undefined;
    if (w) walletsWithAssets.add(w);
  }
  // Minden ismert tárcára állítsunk explicit értéket: verified USD, vagy 0 ha nincs
  // eszköze; a "van eszköz de nincs ár" esetet a undefined + walletsWithAssets jelöli.
  for (const w of wallets) {
    if (!walletsWithAssets.has(w.address) && perWalletUsd[w.address] === undefined) {
      perWalletUsd[w.address] = 0; // valóban üres tárca → explicit $0
    }
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
    assetCount: list.length, dustFiltered, suspiciousFiltered, oversizedNativeUsd, usdHufFactor: factor,
    perChainUsd, perWalletUsd, walletsWithAssets: [...walletsWithAssets], holdingsTruncated, pricingMode,
    assets: list, unverifiedAssets: unverified.slice(0, 60),
    nfts: nfts.slice(0, 150), nftCount, chainErrors,
  };
}
