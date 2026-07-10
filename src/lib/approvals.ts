// B3: In-app ERC-20 approval/allowance lista — KULCS NÉLKÜL (Blockscout v1 logs API,
// CORS: *). Approval(owner, spender, value) eventek a figyelt címre (topic1 = owner),
// láncónként; (token, spender) páronként a LEGUTOLSÓ event nyer; value=0 (revoked)
// kiszűrve. FONTOS korlát (őszintén jelezve a UI-ban): az összeg a legutóbbi Approval
// eventből jön — a spender által MÁR ELKÖLTÖTT keretet nem vonja le (ahhoz páronként
// eth_call allowance() kellene). A revoke maga a revoke.cash deep-linken megy.
import { CHAINS } from "./multichain";

// keccak256("Approval(address,address,uint256)")
const APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
// Blockscout v1 logs API válasz-plafon — e felett a lista csonka lehet.
const LOG_CAP = 1000;
// e felett "unlimited"-ként jelöljük (a gyakorlatban max-uint256 v. 2^255 körüli approve-ok)
const UNLIMITED_MIN = 2n ** 255n;
// token-metadata (symbol/decimals) fetch felső korlátja láncónként — ne DDOS-oljuk a Blockscoutot
const META_CAP = 25;

export interface TokenApproval {
  chain: string; chainName: string; chainColor: string;
  token: string;        // ERC-20 contract cím
  tokenSymbol: string;  // best-effort (Blockscout v2 token endpoint), fallback: rövid cím
  decimals: number;     // best-effort, default 18
  spender: string;
  amount: bigint;       // a legutóbbi Approval event value-ja
  unlimited: boolean;
  timeStamp: number;    // az utolsó Approval event ideje (unix sec)
  txHash: string;
  explorerBase: string; // lánc-explorer (Blockscout host) a spender/tx linkekhez
}

export interface ApprovalsResult {
  approvals: TokenApproval[];
  erroredChains: string[];   // a logs-lekérés bukott → az adott lánc engedélyei ISMERETLENEK
  truncatedChains: string[]; // LOG_CAP elérve → a lánc listája csonka lehet
}

async function jget(url: string, ms = 20000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

/** topic-padolt cím: 0x + 24 nulla + 40 hex kisbetűvel */
function ownerTopic(addr: string): string {
  return "0x" + "0".repeat(24) + addr.toLowerCase().replace(/^0x/, "");
}
/** topic (32 bájt) → cím (utolsó 20 bájt) */
function topicToAddr(topic: string): string {
  return "0x" + (topic || "").slice(-40).toLowerCase();
}

async function chainApprovals(owner: string, chain: (typeof CHAINS)[number]): Promise<{ approvals: TokenApproval[]; truncated: boolean }> {
  const url =
    `${chain.host}/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest` +
    `&topic0=${APPROVAL_TOPIC}&topic1=${ownerTopic(owner)}&topic0_1_opr=and`;
  const j = await jget(url);
  const logs: any[] = Array.isArray(j?.result) ? j.result : [];
  if (!Array.isArray(j?.result) && j?.status !== "0") throw new Error(j?.message || "logs error");

  // (token, spender) → a legutolsó event (block, logIndex szerint növekvő feldolgozás)
  const latest = new Map<string, { amount: bigint; timeStamp: number; txHash: string; token: string; spender: string }>();
  const sorted = logs
    // ERC-721 Approval azonos topic0-val, de indexelt tokenId-vel (4 topic) → kiszűrve;
    // az ERC-20 value a data-ban van, 3 topic-kal.
    .filter((l) => Array.isArray(l.topics) && l.topics.length >= 2 && !l.topics[3])
    .sort((a, b) => (parseInt(a.blockNumber, 16) - parseInt(b.blockNumber, 16)) || (parseInt(a.logIndex || "0x0", 16) - parseInt(b.logIndex || "0x0", 16)));
  for (const l of sorted) {
    let amount = 0n;
    try { amount = l.data && l.data !== "0x" ? BigInt(l.data) : 0n; } catch { continue; }
    const token = (l.address || "").toLowerCase();
    const spender = topicToAddr(l.topics[2] || "");
    if (!token || !spender) continue;
    latest.set(`${token}:${spender}`, {
      amount, token, spender,
      timeStamp: parseInt(l.timeStamp || "0x0", 16),
      txHash: l.transactionHash || "",
    });
  }

  // aktív = a legutolsó event value-ja > 0 (a 0 = revoked)
  const active = [...latest.values()].filter((a) => a.amount > 0n);

  // best-effort token-metadata (symbol + decimals) — capped, hiba → fallback
  const tokens = [...new Set(active.map((a) => a.token))].slice(0, META_CAP);
  const meta = new Map<string, { symbol: string; decimals: number }>();
  await Promise.all(tokens.map(async (t) => {
    try {
      const m = await jget(`${chain.host}/api/v2/tokens/${t}`, 10000);
      meta.set(t, { symbol: (m.symbol || "").slice(0, 12) || t.slice(0, 8) + "…", decimals: Number.isFinite(+m.decimals) ? +m.decimals : 18 });
    } catch { /* fallback lent */ }
  }));

  const approvals: TokenApproval[] = active.map((a) => {
    const m = meta.get(a.token) || { symbol: a.token.slice(0, 8) + "…", decimals: 18 };
    return {
      chain: chain.id, chainName: chain.name, chainColor: chain.color,
      token: a.token, tokenSymbol: m.symbol, decimals: m.decimals,
      spender: a.spender, amount: a.amount, unlimited: a.amount >= UNLIMITED_MIN,
      timeStamp: a.timeStamp, txHash: a.txHash, explorerBase: chain.host,
    };
  }).sort((x, y) => y.timeStamp - x.timeStamp);

  return { approvals, truncated: logs.length >= LOG_CAP };
}

/** Az összes támogatott EVM láncon lekéri az aktív ERC-20 approvalokat a címre.
 *  Lánc-hiba nem blokkol (graceful skip + erroredChains jelzés). */
export async function fetchApprovals(owner: string): Promise<ApprovalsResult> {
  const erroredChains: string[] = [];
  const truncatedChains: string[] = [];
  const all: TokenApproval[] = [];
  const results = await Promise.all(CHAINS.map((c) =>
    chainApprovals(owner, c)
      .then((r) => ({ ok: true as const, chain: c.id, ...r }))
      .catch(() => ({ ok: false as const, chain: c.id, approvals: [] as TokenApproval[], truncated: false })),
  ));
  for (const r of results) {
    if (!r.ok) { erroredChains.push(r.chain); continue; }
    if (r.truncated) truncatedChains.push(r.chain);
    all.push(...r.approvals);
  }
  return { approvals: all.sort((x, y) => y.timeStamp - x.timeStamp), erroredChains, truncatedChains };
}

/** Ember-olvasható összeg (decimals-szel osztva); unlimited → a hívó kezeli. */
export function fmtApprovalAmount(a: TokenApproval): string {
  const n = Number(a.amount) / 10 ** a.decimals;
  if (!Number.isFinite(n)) return "∞";
  if (n >= 1e12) return n.toExponential(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}
