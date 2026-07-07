import { Portfolio } from "./multichain";

// Multichain mock portfólió — a demó KULCS NÉLKÜL is teljes multichain nézetet
// mutasson (ha az élő Blockscout épp lassú/elérhetetlen). Éles úton a valós
// fetchPortfolio megy; ez csak fallback/azonnali demó.
export function mockPortfolio(addr: string): Portfolio {
  const F = 372;
  const A = (symbol: string, chain: string, chainName: string, chainColor: string, amount: number, priceUsd: number) => ({
    symbol, name: symbol, contract: "0x" + symbol.toLowerCase().padEnd(40, "0").slice(0, 40),
    chain, chainName, chainColor, amount, priceUsd,
    valueUsd: amount * priceUsd, valueHuf: amount * priceUsd * F, allocationPct: 0,
  });
  const assets = [
    A("ETH", "eth", "Ethereum", "#627eea", 6.62, 1783),
    A("USDC", "eth", "Ethereum", "#627eea", 42000, 1),
    A("WBTC", "eth", "Ethereum", "#627eea", 0.35, 64000),
    A("ETH", "base", "Base", "#0052ff", 1.8, 1783),
    A("USDC", "base", "Base", "#0052ff", 8400, 1),
    A("ARB", "arbitrum", "Arbitrum", "#28a0f0", 3200, 0.62),
    A("ETH", "arbitrum", "Arbitrum", "#28a0f0", 0.9, 1783),
    A("POL", "polygon", "Polygon", "#8247e5", 5400, 0.42),
    A("GNO", "gnosis", "Gnosis", "#3e6957", 12, 210),
  ];
  const totalUsd = assets.reduce((s, a) => s + a.valueUsd, 0);
  const perChainUsd: Record<string, number> = {};
  for (const a of assets) { a.allocationPct = (100 * a.valueUsd) / totalUsd; perChainUsd[a.chain] = (perChainUsd[a.chain] || 0) + a.valueUsd; }
  assets.sort((x, y) => y.valueUsd - x.valueUsd);
  return {
    addresses: [addr], chains: ["eth", "base", "arbitrum", "polygon", "gnosis"],
    totalUsd, totalHuf: totalUsd * F, assetCount: assets.length, dustFiltered: 7, spamFiltered: 2,
    usdHufFactor: F, perChainUsd, assets,
    nfts: [], nftCount: 0, chainErrors: [],
  };
}
