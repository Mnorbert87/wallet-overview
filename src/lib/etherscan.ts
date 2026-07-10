// Etherscan V2 unified API (chainid=1 = Ethereum mainnet). Egy kulcs, minden EVM.
// A gas-t a KÜLDŐ fizeti → a "gas elégetve" = a wallet által INDÍTOTT tx-ek
// gasUsed×gasPrice összege. A txlist ezt + a native cashflow-t + időbélyeget
// EGY hívásban adja; a tokentx az ERC-20 transzfereket.
const BASE = "https://api.etherscan.io/v2/api";
const KEY = (import.meta.env.VITE_ETHERSCAN_KEY as string) || "";

export interface EthTx {
  hash: string;
  timeStamp: number; // unix sec
  from: string;
  to: string;
  valueWei: bigint;
  gasUsed: bigint;
  gasPrice: bigint; // wei
  isError: boolean;
  isOutgoing: boolean; // a wallet volt a küldő
}

export interface TokenTx {
  hash: string;
  timeStamp: number;
  from: string;
  to: string;
  symbol: string;
  tokenName: string;
  contract: string;
  amount: number; // már decimalsra osztva
  decimals: number;
  isOutgoing: boolean;
}

// Etherscan lapozás: offset a maximum 10000/lap, page-gel lépdelünk.
// A gas-total és a cashflow a TELJES historiát igényli → végig kell lapozni,
// különben 10k tx felett elavul (audit #6). MAX_PAGES a biztonsági plafon
// (200k tx), a lapok közti szünet a free-tier rate limitet (~5 req/s) tartja.
const PAGE_SIZE = 10000;
const MAX_PAGES = 20;
const PAGE_DELAY_MS = 250;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// #8/#9: retry+backoff — r.ok/r.status ellenőrzés; 429/5xx és "rate limit" üzenet
// RETRY-elhető (nem hard throw). Egy tranziens 429 ne dobja el az egész overview-t.
async function call(params: Record<string, string>): Promise<any> {
  const q = new URLSearchParams({ chainid: "1", apikey: KEY, ...params });
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      // #WO key-leak: no-referrer → az apikey-t tartalmazó URL SOHA nem megy ki
      // Referer-headerben harmadik félnek (a query-string kulcs így nem szivárog).
      const r = await fetch(`${BASE}?${q}`, { referrerPolicy: "no-referrer" });
      if (!r.ok) {
        if (r.status === 429 || r.status >= 500) { lastErr = new Error(`Etherscan ${r.status}`); await sleep(500 * (i + 1)); continue; }
        throw new Error(`Etherscan ${r.status}`);
      }
      const j = await r.json();
      if (j.status === "0" && !Array.isArray(j.result)) {
        if (typeof j.result === "string" && /no transactions|no records/i.test(j.result)) return [];
        if (typeof j.result === "string" && /rate limit|max .*limit/i.test(j.result)) { lastErr = new Error(j.result); await sleep(500 * (i + 1)); continue; }
        throw new Error(j.result || j.message || "Etherscan hiba");
      }
      return Array.isArray(j.result) ? j.result : [];
    } catch (e) { lastErr = e; if (i < 2) await sleep(500 * (i + 1)); }
  }
  throw lastErr;
}

// Végiglapozza az ÖSSZES sort (asc) — aggregációhoz (gas, cashflow, hó-bontás).
// #8: terminal hiba egy lapon → visszaadjuk az EDDIG felgyűlt sorokat (partial),
// nem dobjuk el az egész history-t egyetlen kései 429 miatt.
// #WO-1: `truncated` jelzi, ha a history CSONKA lehet — vagy egy lap hibára futott
// lapkimerülés ELŐTT, vagy elértük a MAX_PAGES plafont tele lappal. A hívó ezt
// felviszi az Overview-ba, hogy a "gas elégetve" / cashflow ne látsszon teljesnek.
async function callAll(params: Record<string, string>): Promise<{ rows: any[]; truncated: boolean }> {
  const out: any[] = [];
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    let rows: any[];
    try {
      rows = await call({ ...params, sort: "asc", page: String(page), offset: String(PAGE_SIZE) });
    } catch {
      truncated = true; // #WO-1: hiba lapkimerülés előtt → partial, jelzés a hívónak
      break;
    }
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break; // ez volt az utolsó lap
    // #WO-1: elértük az utolsó engedélyezett lapot, de az még tele volt → van több adat
    if (page === MAX_PAGES) { truncated = true; break; }
    await sleep(PAGE_DELAY_MS);
  }
  return { rows: out, truncated };
}

function mapNormal(rows: any[], a: string): EthTx[] {
  return rows.map((t: any): EthTx => ({
    hash: t.hash,
    timeStamp: Number(t.timeStamp),
    from: (t.from || "").toLowerCase(),
    to: (t.to || "").toLowerCase(),
    valueWei: BigInt(t.value || "0"),
    gasUsed: BigInt(t.gasUsed || "0"),
    gasPrice: BigInt(t.gasPrice || "0"),
    isError: t.isError === "1",
    isOutgoing: (t.from || "").toLowerCase() === a,
  }));
}

function mapToken(rows: any[], a: string): TokenTx[] {
  return rows.map((t: any): TokenTx => {
    const dec = Number(t.tokenDecimal || "18");
    return {
      hash: t.hash,
      timeStamp: Number(t.timeStamp),
      from: (t.from || "").toLowerCase(),
      to: (t.to || "").toLowerCase(),
      symbol: t.tokenSymbol || "?",
      tokenName: t.tokenName || "",
      contract: (t.contractAddress || "").toLowerCase(),
      amount: Number(t.value || "0") / 10 ** dec,
      decimals: dec,
      isOutgoing: (t.from || "").toLowerCase() === a,
    };
  });
}

export async function getNormalTxs(addr: string): Promise<{ txs: EthTx[]; truncated: boolean }> {
  const a = addr.toLowerCase();
  const { rows, truncated } = await callAll({
    module: "account", action: "txlist", address: addr,
    startblock: "0", endblock: "99999999",
  });
  return { txs: mapNormal(rows, a), truncated };
}

export async function getTokenTxs(addr: string): Promise<{ txs: TokenTx[]; truncated: boolean }> {
  const a = addr.toLowerCase();
  const { rows, truncated } = await callAll({
    module: "account", action: "tokentx", address: addr,
    startblock: "0", endblock: "99999999",
  });
  return { txs: mapToken(rows, a), truncated };
}
