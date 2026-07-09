# Wallet-Overview — Audit findings (2026-07-08)

Multi-agent audit (12 agents, 5 dimensions + adversarial verify). File:line refs verified against source.

## SHIP-BLOCKER
Keyless public build re-opens the scam-"ETH" $34k bug: verification is still symbol-based there.

## CRITICAL (distorts totals / security)
1. multichain.ts:152 — keyless mode gives `verified` on bare symbol via `ALLOWLIST.has(sym)`; CG cross-check only under `if(CG_KEY)`. Fix: canonical `{symbol->{chain->contract}}` map, verified ONLY on contract match.
2. multichain.ts:204,206 — sanity-cap only runs on `!verified`; spoofed "USDC" skips it. Fix: cap on verified branch too (allowlist-contract exception).
3. multichain.ts:246 — cross-check catch is no-op (fail-open); on 429 scam keeps symbol-verified. Fix: `a.verified=false` in catch + retry/backoff.
4. price.ts:16-21 — `interval:"daily"` + days 3650 → CG free-tier 4xx → throw → App.tsx:83 mockOverview(). Fix: drop interval, clamp days to 365 keyless, graceful degrade.
5. multichain.ts:120-124 — only nftRes is caught; token-endpoint 429 drops whole chain incl native balance. Fix: separate `.catch` fallbacks for toks/acct.
6. etherscan.ts:49 — sort asc + offset 10000, no pagination → gas-total & cashflow stale past 10k tx. Fix: full page-loop for gas; separate desc for recent table.
7. solana.ts:64-65,72 — solUsd=0 on rate-limit → SOL dropped from list; same EVM-native xDAI multichain.ts:132. Fix: native always shown (amount>0), price 0 → "price unavailable".
8. multichain.ts:135,155 — Blockscout only 1st page (~50 items) → missing holdings in totals. Fix: next_page_params loop (cap 5-10).
9. multichain.ts:239 — CG key in URL query (history/Referer leak) vs price.ts:18 header. Fix: header everywhere.

## IMPORTANT (UX / missing feature)
- i18n gap: EN-only build still half-Hungarian — Watchlist.tsx (always renders), App.tsx:281-308 activity/gas, Extras.tsx StoryCard/Approvals, TxTable.tsx, pie "Egyéb". Route through t().
- StoryCard claims "valós on-chain aktivitásból" even in mock branch — thread isMock prop.
- Cashflow/balance misleading: token-move usd:0 (compute.ts:97), story-balance net-flow approx (compute.ts:110) not real coin_balance.
- Token-2022 SPL invisible — solana.ts:8 legacy program only; add 2nd getTokenAccountsByOwner.
- rate=0 real token silently dropped as spam (multichain.ts:40) — prefer verified=false + "≈ price?".
- SPAM_RE drops real: yearn.finance (YFI), non-ASCII symbols (multichain.ts:26,39).
- Disclaimer source inaccurate "Etherscan + CoinGecko" (i18n.ts:42) — also Blockscout/SOL/BTC.
- a11y: input aria-label, toggles aria-pressed, icon buttons aria-label, TxTable empty state.

## NICE-TO-HAVE
- Cross-wallet merge (aggregate.ts:32): same token on two addresses = two rows.
- Redundant USD/HUF factor N+1 CG calls (multichain.ts:163).
- NFT image-URL scheme allowlist (https/ipfs/data:image) + NFT collection-name through spam filter.

Priority: #1->#3 (security/total) -> #4 (mock crash) -> #5-8 (asset under-count) -> i18n -> rest.
