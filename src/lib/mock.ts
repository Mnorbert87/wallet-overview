import { Overview, TxRow, MonthFlow } from "./compute";

// Beépített MOCK áttekintő — hogy a demó Etherscan-kulcs NÉLKÜL is teljes
// dashboardot mutasson. Éles kulccsal a valódi lánc-adat megy (lásd App).
function months(): MonthFlow[] {
  const base = [
    ["2021-03", 4200, 900], ["2021-05", 12800, 3100], ["2021-11", 8600, 15400],
    ["2022-06", 2100, 6900], ["2023-02", 9800, 1200], ["2024-09", 15600, 4300],
    ["2025-12", 6400, 11200], ["2026-06", 3300, 800],
  ] as const;
  return base.map(([ym, inU, outU]) => ({
    ym, inUsd: inU, outUsd: outU, inHuf: inU * 372, outHuf: outU * 372,
  }));
}

function rows(): TxRow[] {
  const seed = [
    ["2026-06-28", "in", "ETH", 1.25, 4462, 1.66e6, 0, 0],
    ["2026-06-27", "out", "ETH", 0.8, 2855, 1.06e6, 3.1, 1153],
    ["2026-06-21", "out", "USDC", 2500, 0, 0, 2.4, 892],
    ["2026-05-14", "in", "ETH", 3.4, 11220, 4.17e6, 0, 0],
    ["2026-04-02", "out", "ETH", 0.15, 480, 178560, 1.9, 706],
    ["2026-02-18", "in", "WETH", 5.0, 0, 0, 0, 0],
    ["2025-12-30", "out", "ETH", 2.1, 7245, 2.69e6, 4.2, 1562],
    ["2025-11-11", "in", "ETH", 0.5, 1420, 528240, 0, 0],
  ] as const;
  return seed.map(([d, dir, kind, amt, usd, huf, gu, gh], i) => ({
    hash: "0xmock" + i,
    timeStamp: Math.floor(new Date(d + "T12:00:00Z").getTime() / 1000),
    kind, direction: dir as "in" | "out", amount: amt,
    usd, huf, gasUsd: gu, gasHuf: gh, failed: false,
  }));
}

export function mockOverview(): Overview {
  const monthly = months();
  const inUsd = monthly.reduce((s, m) => s + m.inUsd, 0);
  const outUsd = monthly.reduce((s, m) => s + m.outUsd, 0);
  const gasUsd = 214.3, gasEth = 0.121;
  return {
    address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    txCount: 342, tokenTxCount: 128,
    firstTx: Math.floor(new Date("2021-03-11T09:00:00Z").getTime() / 1000),
    lastTx: Math.floor(new Date("2026-06-28T12:00:00Z").getTime() / 1000),
    gas: { eth: gasEth, usd: gasUsd, huf: gasUsd * 372 },
    inflow: { eth: 21.4, usd: inUsd, huf: inUsd * 372 },
    outflow: { eth: 12.9, usd: outUsd, huf: outUsd * 372 },
    balanceEth: 8.38,
    holdingValue: { usd: 8.38 * 1791, huf: 8.38 * 1791 * 372 },
    monthly,
    mostActiveMonth: { ym: "2021-11", count: 47 },
    txRows: rows(),
    tokenSymbols: ["USDC", "WETH", "DAI", "UNI", "LINK", "ENS"],
    counterparties: [
      { address: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d", count: 38 }, // Uniswap V2 Router
      { address: "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f", count: 21 }, // SushiSwap Router
      { address: "0x00000000006c3852cbef3e08e8df289169ede581", count: 14 }, // Seaport
      { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", count: 9 }, // USDC
    ],
    priceDegraded: false,
  };
}
