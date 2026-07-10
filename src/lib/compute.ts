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
  whale: boolean; // nagy-mozgás: a tárca saját ETH-eloszlásához mért kiugró érték
}

export interface Overview {
  address: string;       // első cím (fejléc-fallback + CSV-fájlnév)
  addresses: string[];   // B1: az összes aggregált EVM cím
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
  txTruncated: boolean; // #WO-1: a tx-előzmény csonka (lapozás-cap / hiba) → gas + cashflow alábecsülhet
}

// B1: az aktivitás/gas/cashflow MINDEN EVM címre aggregál (nem csak az elsőre),
// hogy a gas-hero és a cashflow ugyanazt az összevont portfóliót tükrözze, mint a
// holdings-panel. Címenként SZEKVENCIÁLIS fetch (Etherscan free-tier rate-limit),
// címen belül parallel (txlist + tokentx).
export async function buildOverview(addresses: string[]): Promise<Overview> {
  const addrs = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const watched = new Set(addrs);
  const perAddr: { addr: string; normal: EthTx[]; tokens: TokenTx[] }[] = [];
  let txTruncated = false; // #WO-1
  for (const a of addrs) {
    const [normalRes, tokenRes] = await Promise.all([getNormalTxs(a), getTokenTxs(a)]);
    perAddr.push({ addr: a, normal: normalRes.txs, tokens: tokenRes.txs });
    if (normalRes.truncated || tokenRes.truncated) txTruncated = true;
  }

  const allSecs = perAddr.flatMap((p) => [...p.normal.map((t) => t.timeStamp), ...p.tokens.map((t) => t.timeStamp)]);
  const firstTx = allSecs.length ? Math.min(...allSecs) : Math.floor(Date.now() / 1000);
  const lastTx = allSecs.length ? Math.max(...allSecs) : firstTx;

  // ethSpot már nem dob (retry+{0,0}); a catch belt-and-suspenders — a spot csak a
  // JELENLEGI holding-értéket árazza, sosem szabad a teljes fetchelt history-t eldobnia.
  const [pmap, spot] = await Promise.all([
    ethPriceMap(firstTx),
    ethSpot().catch(() => ({ usd: 0, huf: 0 })),
  ]);

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

  // B1: cross-wallet dedup. Ugyanaz a tx-hash a KÜLDŐ és a FOGADÓ listájában is
  // megjelenik, ha mindkét cím figyelt → txCount/monthCount hash-enként EGYSZER számol.
  // A gas nem duplázódhat (csak isOutgoing-on fut, egy tx-nek egy küldője van).
  const seenNormal = new Set<string>();
  let normalCount = 0;
  for (const { addr, normal } of perAddr) {
    for (const t of normal) {
      const firstSeen = !seenNormal.has(t.hash);
      if (firstSeen) { seenNormal.add(t.hash); normalCount++; }
      const ym = new Date(t.timeStamp * 1000).toISOString().slice(0, 7);
      if (firstSeen) monthCount.set(ym, (monthCount.get(ym) || 0) + 1);
      const cp = t.isOutgoing ? t.to : t.from;
      // B1: figyelt cím nem "partner" — a belső mozgás nem counterparty.
      if (cp && cp !== addr && !watched.has(cp)) cpCount.set(cp, (cpCount.get(cp) || 0) + 1);
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
      // B1: BELSŐ transzfer (figyelt → figyelt) NEM inflow/outflow — az összevont
      // portfólió szintjén nem pénzmozgás, csak átrendezés; különben mindkét
      // metrikát azonos összeggel inflálná. A gas természetesen marad.
      const internal = watched.has(t.from) && watched.has(t.to);
      if (valEth > 0 && !internal) {
        if (t.isOutgoing) { outflow.eth += valEth; outflow.usd += usd; outflow.huf += huf; bump(ym, "out", usd, huf); }
        else { inflow.eth += valEth; inflow.usd += usd; inflow.huf += huf; bump(ym, "in", usd, huf); }
      }
      if (valEth > 0 || t.isOutgoing) {
        rows.push({
          hash: t.hash, timeStamp: t.timeStamp, kind: "ETH",
          direction: t.isOutgoing ? "out" : "in", amount: valEth,
          usd, huf, gasUsd, gasHuf, failed: t.isError, whale: false,
        });
      }
    }
  }

  // B1: token-transzfer dedup kulcs — ugyanaz a transfer-event a küldő ÉS a fogadó
  // tokentx-listájában is szerepel, ha mindkettő figyelt.
  const seenToken = new Set<string>();
  let tokenCount = 0;
  const tokenSymbolSet = new Set<string>();
  for (const { tokens } of perAddr) {
    for (const t of tokens) {
      const k = `${t.hash}:${t.contract}:${t.from}:${t.to}:${t.amount}`;
      if (!seenToken.has(k)) { seenToken.add(k); tokenCount++; }
      tokenSymbolSet.add(t.symbol);
      // #WO-7: NEM növeljük itt a monthCount-ot — a "legaktívabb hónap" a headline txCount-tal
      // KONZISZTENS, csak normal-tx-eket számol. Egy normal-tx több token-
      // transfer-eventet emittálhat, így a blend félrevezetően a tx-számnál nagyobbat adna.
      // Token USD/HUF értékelés = 2. kör (per-token CoinGecko id kell); MVP-ben az
      // ÖSSZEGET ETH-ben nem keverjük, a sorban a token-mennyiség jelenik meg.
      rows.push({
        hash: t.hash, timeStamp: t.timeStamp, kind: t.symbol,
        direction: t.isOutgoing ? "out" : "in", amount: t.amount,
        usd: 0, huf: 0, gasUsd: 0, gasHuf: 0, failed: false, whale: false,
      });
    }
  }

  rows.sort((a, b) => b.timeStamp - a.timeStamp);

  // Nagy-mozgás (whale) flag: a tárca SAJÁT árazott ETH-tranzakcióihoz mért kiugró
  // érték — dinamikus küszöb (median × mult), $1k alsó padlóval a zaj kiszűrésére.
  // Így egy kis és egy bálna-tárcánál is a rá jellemzőhöz képest jelöl. Token-sorok
  // (usd=0, árazatlan) sosem jelölődnek — nem árazzuk túl őket.
  const WHALE_FLOOR_USD = 1000, WHALE_MULT = 5;
  const pricedUsd = rows.filter((r) => r.kind === "ETH" && r.usd > 0).map((r) => r.usd).sort((a, b) => a - b);
  if (pricedUsd.length >= 4) {
    const median = pricedUsd[Math.floor(pricedUsd.length / 2)];
    const threshold = Math.max(WHALE_FLOOR_USD, median * WHALE_MULT);
    for (const r of rows) if (r.kind === "ETH" && r.usd >= threshold) r.whale = true;
  }

  let most: { ym: string; count: number } | null = null;
  for (const [ym, c] of monthCount) if (!most || c > most.count) most = { ym, count: c };

  const monthly = [...monthMap.values()].sort((a, b) => a.ym.localeCompare(b.ym));
  const balanceEth = inflow.eth - outflow.eth - gas.eth;

  return {
    address: addrs[0] || "",
    addresses: addrs,
    txCount: normalCount,
    tokenTxCount: tokenCount,
    firstTx, lastTx,
    gas, inflow, outflow,
    balanceEth,
    holdingValue: { usd: Math.max(0, balanceEth) * spot.usd, huf: Math.max(0, balanceEth) * spot.huf },
    monthly,
    mostActiveMonth: most,
    txRows: rows.slice(0, 200),
    tokenSymbols: [...tokenSymbolSet].slice(0, 12),
    counterparties: [...cpCount.entries()]
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    priceDegraded: priceDataDegraded(), // #6: az ársor hiányos volt?
    txTruncated, // #WO-1: a tx-előzmény csonka volt?
  };
}
