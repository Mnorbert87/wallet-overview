// Bitcoin holdings KULCS NÉLKÜL — mempool.space public API (cím → egyenleg).
// BTC natív-only (nincs token-réteg); ár CoinGecko. USD+HUF.
import { Asset } from "./multichain";

const MEMPOOL = "https://mempool.space/api";
const CG = "https://api.coingecko.com/api/v3";
const CHAIN_COLOR = "#f7931a";

// #19: mempool account-fetch retry-vel (1 db 429 ne ürítse ki a BTC-láncot).
async function mempoolAccount(addr: string): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(`${MEMPOOL}/address/${encodeURIComponent(addr)}`);
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) throw new Error(`mempool ${r.status}`);
      lastErr = new Error(`mempool ${r.status}`);
    } catch (e) { lastErr = e; }
    await new Promise((res) => setTimeout(res, 500 * (i + 1)));
  }
  throw lastErr;
}

export async function fetchBitcoin(addr: string, factor: number): Promise<{ assets: Asset[]; error?: boolean }> {
  try {
    const [acct, priceR] = await Promise.all([
      mempoolAccount(addr),
      fetch(`${CG}/simple/price?ids=bitcoin&vs_currencies=usd`).catch(() => null),
    ]);
    const price = priceR && priceR.ok ? await priceR.json() : {};
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
      // #4/#25: CSAK akkor verified (a totálba számít), ha van valós ár. Ár nélkül a
      // sor látszik "price unavailable"-lel, de NEM húzza $0-ra a headline-t.
      allocationPct: 0, verified: btcUsd > 0,
    };
    return { assets: [asset] };
  } catch {
    return { assets: [], error: true };
  }
}
