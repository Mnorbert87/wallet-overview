import { getNormalTxs, getTokenTxs, EthTx, TokenTx } from "./etherscan";
import { ethPriceMap, ethSpot, priceAt, PriceMap, priceDataDegraded } from "./price";

const WEI = 1e18;

export interface DualValue { eth: number; usd: number; huf: number; }
export interface MonthFlow { ym: string; inUsd: number; outUsd: number; inHuf: number; outHuf: number; }

export interface TxRow {
  hash: string;
  timeStamp: number;
  kind: "ETH" | string; // ETH vagy token-symbol
  direction: "in" | "out";
  amount: number;
  usd: number;
  huf: number;
  gasUsd: number; // csak kimenő native tx-en
  gasHuf: number;
  failed: boolean;
}

export interface Overview {
  address: string;
  txCount: number;
  tokenTxCount: number;
  firstTx: number;
  lastTx: number;
  gas: DualValue;        // összes elégetett gas
  inflow: DualValue;     // beérkező native ETH (akkori árfolyamon)
  outflow: DualValue;    // kimenő native ETH
  balanceEth: number;    // net ETH mozgás (nem a valós egyenleg — MVP közelítés)
  holdingValue: { usd: number; huf: number }; // net ETH * spot
  monthly: MonthFlow[];
  mostActiveMonth: { ym: string; count: number } | null;
  txRows: TxRow[];       // egyesített, idő szerint csökkenő
  tokenSymbols: string[];
  counterparties: { address: string; count: number }[]; // top interakciós címek
  priceDegraded: boolean; // #6: az ársor hiányos/vágott → USD/HUF becslés megbízhatatlan
}

export async function buildOverview(address: string): Promise<Overview> {
  const addr = address.toLowerCase();
  const [normal, tokens] = await Promise.all([getNormalTxs(addr), getTokenTxs(addr)]);

  const allSecs = [...normal.map((t) => t.timeStamp), ...tokens.map((t) => t.timeStamp)];
  const firstTx = allSecs.length ? Math.min(...allSecs) : Math.floor(Date.now() / 1000);
  const lastTx = allSecs.length ? Math.max(...allSecs) : firstTx;

  const [pmap, spot] = await Promise.all([ethPriceMap(firstTx), ethSpot()]);

  const gas: DualValue = { eth: 0, usd: 0, huf: 0 };
  const inflow: DualValue = { eth: 0, usd: 0, huf: 0 };
  const outflow: DualValue = { eth: 0, usd: 0, huf: 0 };
  const monthMap = new Map<string, MonthFlow>();
  const monthCount = new Map<string, number>();
  const cpCount = new Map<string, number>();
  const rows: TxRow[] = [];

  const bump = (ym: string, k: "in" | "out", usd: number, huf: number) => {
    const m = monthMap.get(ym) || { ym, inUsd: 0, outUsd: 0, inHuf: 0, outHuf: 0 };
    if (k === "in") { m.inUsd += usd; m.inHuf += huf; } else { m.outUsd += usd; m.outHuf += huf; }
    monthMap.set(ym, m);
  };

  for (const t of normal) {
    const ym = new Date(t.timeStamp * 1000).toISOString().slice(0, 7);
    monthCount.set(ym, (monthCount.get(ym) || 0) + 1);
    const cp = t.isOutgoing ? t.to : t.from;
    if (cp && cp !== addr) cpCount.set(cp, (cpCount.get(cp) || 0) + 1);
    const p = priceAt(pmap, t.timeStamp);
    // gas: csak a wallet által küldött tx-en (a küldő fizeti)
    let gasUsd = 0, gasHuf = 0;
    if (t.isOutgoing) {
      const gasEth = Number(t.gasUsed * t.gasPrice) / WEI;
      gas.eth += gasEth; gasUsd = gasEth * p.usd; gasHuf = gasEth * p.huf;
      gas.usd += gasUsd; gas.huf += gasHuf;
    }
    const valEth = Number(t.valueWei) / WEI;
    const usd = valEth * p.usd, huf = valEth * p.huf;
    if (valEth > 0) {
      if (t.isOutgoing) { outflow.eth += valEth; outflow.usd += usd; outflow.huf += huf; bump(ym, "out", usd, huf); }
      else { inflow.eth += valEth; inflow.usd += usd; inflow.huf += huf; bump(ym, "in", usd, huf); }
    }
    if (valEth > 0 || t.isOutgoing) {
      rows.push({
        hash: t.hash, timeStamp: t.timeStamp, kind: "ETH",
        direction: t.isOutgoing ? "out" : "in", amount: valEth,
        usd, huf, gasUsd, gasHuf, failed: t.isError,
      });
    }
  }

  for (const t of tokens) {
    // #WO-7: NEM növeljük itt a monthCount-ot — a "legaktívabb hónap" a headline txCount-tal
    // (normal.length) KONZISZTENS, csak normal-tx-eket számol. Egy normal-tx több token-
    // transfer-eventet emittálhat, így a blend félrevezetően a tx-számnál nagyobbat adna.
    // Token USD/HUF értékelés = 2. kör (per-token CoinGecko id kell); MVP-ben az
    // ÖSSZEGET ETH-ben nem keverjük, a sorban a token-mennyiség jelenik meg.
    rows.push({
      hash: t.hash, timeStamp: t.timeStamp, kind: t.symbol,
      direction: t.isOutgoing ? "out" : "in", amount: t.amount,
      usd: 0, huf: 0, gasUsd: 0, gasHuf: 0, failed: false,
    });
  }

  rows.sort((a, b) => b.timeStamp - a.timeStamp);

  let most: { ym: string; count: number } | null = null;
  for (const [ym, c] of monthCount) if (!most || c > most.count) most = { ym, count: c };

  const monthly = [...monthMap.values()].sort((a, b) => a.ym.localeCompare(b.ym));
  const balanceEth = inflow.eth - outflow.eth - gas.eth;

  return {
    address: addr,
    txCount: normal.length,
    tokenTxCount: tokens.length,
    firstTx, lastTx,
    gas, inflow, outflow,
    balanceEth,
    holdingValue: { usd: Math.max(0, balanceEth) * spot.usd, huf: Math.max(0, balanceEth) * spot.huf },
    monthly,
    mostActiveMonth: most,
    txRows: rows.slice(0, 200),
    tokenSymbols: [...new Set(tokens.map((t) => t.symbol))].slice(0, 12),
    counterparties: [...cpCount.entries()]
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    priceDegraded: priceDataDegraded(), // #6: az ársor hiányos volt?
  };
}
