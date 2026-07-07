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

async function call(params: Record<string, string>): Promise<any> {
  const q = new URLSearchParams({ chainid: "1", apikey: KEY, ...params });
  const r = await fetch(`${BASE}?${q}`);
  const j = await r.json();
  // status "0" + "No transactions found" nem hiba — üres lista.
  if (j.status === "0" && !Array.isArray(j.result)) {
    if (typeof j.result === "string" && /no transactions|no records/i.test(j.result)) return [];
    throw new Error(j.result || j.message || "Etherscan hiba");
  }
  return Array.isArray(j.result) ? j.result : [];
}

export async function getNormalTxs(addr: string): Promise<EthTx[]> {
  const a = addr.toLowerCase();
  const rows = await call({
    module: "account", action: "txlist", address: addr,
    startblock: "0", endblock: "99999999", sort: "asc", page: "1", offset: "10000",
  });
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

export async function getTokenTxs(addr: string): Promise<TokenTx[]> {
  const a = addr.toLowerCase();
  const rows = await call({
    module: "account", action: "tokentx", address: addr,
    startblock: "0", endblock: "99999999", sort: "asc", page: "1", offset: "10000",
  });
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
