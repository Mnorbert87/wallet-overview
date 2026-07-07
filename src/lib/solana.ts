// Solana holdings KULCS NÉLKÜL — public JSON-RPC (getBalance + SPL token-accounts).
// Ár: CoinGecko (SOL native + curated SPL mint-allowlist). A nem-allowlistolt SPL
// token "nem ellenőrzött árú" (a Blockscout/mint-ár spamnál hamis lehet) — a totálon
// kívül, ugyanaz az őszinte minta, mint az EVM oldalon.
import { Asset } from "./multichain";

const RPC = "https://api.mainnet-beta.solana.com";
const SPL_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const CG = "https://api.coingecko.com/api/v3";
const CHAIN_COLOR = "#14f195";

// Curated SPL mint → CoinGecko-id (valódi likvid tokenek). A többi SPL → unverified.
const SPL_ALLOW: Record<string, { symbol: string; cg: string }> = {
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", cg: "usd-coin" },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", cg: "tether" },
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": { symbol: "JUP", cg: "jupiter-exchange-solana" },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { symbol: "BONK", cg: "bonk" },
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": { symbol: "WIF", cg: "dogwifcoin" },
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL": { symbol: "JTO", cg: "jito-governance-token" },
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3": { symbol: "PYTH", cg: "pyth-network" },
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": { symbol: "RAY", cg: "raydium" },
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": { symbol: "mSOL", cg: "msol" },
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": { symbol: "jitoSOL", cg: "jito-staked-sol" },
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": { symbol: "stSOL", cg: "lido-staked-sol" },
};

async function rpc(method: string, params: any[]): Promise<any> {
  const r = await fetch(RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!r.ok) throw new Error(`Solana RPC ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "Solana RPC error");
  return j.result;
}

async function cgPrices(ids: string[]): Promise<Record<string, { usd: number }>> {
  if (!ids.length) return {};
  try {
    const r = await fetch(`${CG}/simple/price?ids=${[...new Set(ids)].join(",")}&vs_currencies=usd`);
    return r.ok ? await r.json() : {};
  } catch { return {}; }
}

export async function fetchSolana(addr: string, factor: number): Promise<{ assets: Asset[]; error?: boolean }> {
  try {
    const [bal, toks] = await Promise.all([
      rpc("getBalance", [addr]),
      rpc("getTokenAccountsByOwner", [addr, { programId: SPL_PROGRAM }, { encoding: "jsonParsed" }]),
    ]);
    const solAmt = (bal?.value ?? 0) / 1e9;

    // begyűjtjük a mint→amount-ot (több account is lehet egy mintre)
    const byMint = new Map<string, number>();
    for (const a of toks?.value || []) {
      const info = a.account?.data?.parsed?.info;
      const mint = info?.mint;
      const ui = info?.tokenAmount?.uiAmount || 0;
      if (mint && ui > 0) byMint.set(mint, (byMint.get(mint) || 0) + ui);
    }

    const allowIds = ["solana", ...[...byMint.keys()].filter((m) => SPL_ALLOW[m]).map((m) => SPL_ALLOW[m].cg)];
    const prices = await cgPrices(allowIds);
    const solUsd = prices["solana"]?.usd || 0;

    const assets: Asset[] = [];
    const mk = (symbol: string, name: string, contract: string, amount: number, price: number, verified: boolean): Asset => ({
      symbol, name, contract, chain: "sol", chainName: "Solana", chainColor: CHAIN_COLOR,
      amount, priceUsd: price, valueUsd: amount * price, valueHuf: amount * price * factor, allocationPct: 0, verified,
    });
    if (solAmt * solUsd >= 0.01) assets.push(mk("SOL", "Solana", "native", solAmt, solUsd, true));
    for (const [mint, amt] of byMint) {
      const meta = SPL_ALLOW[mint];
      if (meta) {
        const px = prices[meta.cg]?.usd || 0;
        if (amt * px >= 0.01) assets.push(mk(meta.symbol, meta.symbol, mint, amt, px, true));
        else assets.push(mk(meta.symbol, meta.symbol, mint, amt, 0, false));
      } else {
        // nem-allowlistolt SPL → unverified (mennyiség valós, ár nem igazolt)
        assets.push(mk(mint.slice(0, 4) + "…", "SPL token", mint, amt, 0, false));
      }
    }
    return { assets };
  } catch {
    return { assets: [], error: true };
  }
}
