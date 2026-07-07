// Bitcoin holdings KULCS NÉLKÜL — mempool.space public API (cím → egyenleg).
// BTC natív-only (nincs token-réteg); ár CoinGecko. USD+HUF.
import { Asset } from "./multichain";

const MEMPOOL = "https://mempool.space/api";
const CG = "https://api.coingecko.com/api/v3";
const CHAIN_COLOR = "#f7931a";

export async function fetchBitcoin(addr: string, factor: number): Promise<{ assets: Asset[]; error?: boolean }> {
  try {
    const [acctR, priceR] = await Promise.all([
      fetch(`${MEMPOOL}/address/${encodeURIComponent(addr)}`),
      fetch(`${CG}/simple/price?ids=bitcoin&vs_currencies=usd`),
    ]);
    if (!acctR.ok) throw new Error(`mempool ${acctR.status}`);
    const acct = await acctR.json();
    const price = priceR.ok ? await priceR.json() : {};
    const btcUsd = price.bitcoin?.usd || 0;

    const cs = acct.chain_stats || {};
    const ms = acct.mempool_stats || {};
    const sats = (cs.funded_txo_sum || 0) - (cs.spent_txo_sum || 0)
               + (ms.funded_txo_sum || 0) - (ms.spent_txo_sum || 0);
    const btc = sats / 1e8;
    if (btc <= 0) return { assets: [] };

    const asset: Asset = {
      symbol: "BTC", name: "Bitcoin", contract: "native",
      chain: "btc", chainName: "Bitcoin", chainColor: CHAIN_COLOR,
      amount: btc, priceUsd: btcUsd, valueUsd: btc * btcUsd, valueHuf: btc * btcUsd * factor,
      allocationPct: 0, verified: true,
    };
    return { assets: [asset] };
  } catch {
    return { assets: [], error: true };
  }
}
